/**
 * Code.js: GAS 固有部分（Web アプリの入口・シート・排他・キャッシュ）。
 * ロジックは core.js の純粋関数に置く。
 *
 * 設定の読み順: Script Properties → (SHEET_ID は) env.js の SHEET_ID_DEFAULT / (PASSPHRASE, DEADLINE_ISO は) シートの config タブ。
 * env.js は deploy.sh が gas/env/<環境>.js から src/env.js へコピーする（SHEET_ID はシークレットではない）。
 * 合言葉はシートの config タブ（A列=キー, B列=値）で変える。Script Properties に PASSPHRASE を置けばそちらが優先。
 */

var THROTTLE_SECONDS = 10;
var MAX_BAD_PASSPHRASE = 5;
var BAD_PASSPHRASE_WINDOW = 15 * 60;

var configCache_ = null;

function sheetId_() {
  var v = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (v) return v;
  return (typeof SHEET_ID_DEFAULT !== 'undefined') ? SHEET_ID_DEFAULT : '';
}

function prop_(key, fallback) {
  if (key === 'SHEET_ID') return sheetId_() || fallback;
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (v !== null && v !== '') return v;
  if (configCache_ === null) {
    configCache_ = {};
    try {
      var sh = SpreadsheetApp.openById(sheetId_()).getSheetByName('config');
      if (sh && sh.getLastRow() >= 1) {
        sh.getRange(1, 1, sh.getLastRow(), 2).getValues().forEach(function (r) {
          if (r[0]) configCache_[String(r[0]).trim()] = String(r[1]);
        });
      }
    } catch (err) { configCache_ = {}; }
  }
  var c = configCache_[key];
  return (c === undefined || c === '') ? fallback : c;
}

function nowStr_() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function readRows_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var vals = sheet.getRange(2, 1, last - 1, 4).getValues();
  return vals.map(function (r) { return { code: String(r[0]).trim(), email: String(r[1]).trim() }; });
}

function doGet() {
  var open = isOpen(new Date(), prop_('DEADLINE_ISO', DEFAULT_DEADLINE_ISO));
  var remaining = null;
  try {
    var ss = SpreadsheetApp.openById(prop_('SHEET_ID', ''));
    remaining = countRemaining(readRows_(ss.getSheetByName('codes')));
  } catch (err) {
    remaining = null;
  }
  return json_({ ok: true, service: 'ai-challenge-voucher', open: open, remaining: remaining });
}

function doPost(e) {
  var email = '';
  var result;
  var reason = '';
  var name = '';
  try {
    var req = null;
    try { req = JSON.parse(e && e.postData && e.postData.contents); } catch (err) { req = null; }
    if (req && typeof req === 'object') {
      email = normalizeEmail(req.email);
      name = normalizeText(req.name).slice(0, 100);
    }
    result = handle_(req, email, name);
  } catch (err) {
    result = buildError('server_error');
    reason = String(err && err.message || err).slice(0, 200);
  }
  log_(email, name, result, reason);
  return json_(result);
}

function handle_(req, email, name) {
  var cache = CacheService.getScriptCache();
  var failKey = 'fail:' + email;
  var throttleKey = 'thr:' + email;

  if (!req || typeof req !== 'object' || !email) return buildError('bad_request');

  var fails = parseInt(cache.get(failKey) || '0', 10);
  var v = validateRequest(req, {
    now: new Date(),
    deadlineIso: prop_('DEADLINE_ISO', DEFAULT_DEADLINE_ISO),
    passphrase: prop_('PASSPHRASE', ''),
    attemptsExceeded: fails >= MAX_BAD_PASSPHRASE
  });
  if (!v.ok) {
    if (v.error === 'bad_passphrase') {
      cache.put(failKey, String(fails + 1), BAD_PASSPHRASE_WINDOW);
    }
    return buildError(v.error);
  }

  // 10秒に1回（検査を通った要求だけ数える）
  if (cache.get(throttleKey)) return buildError('rate_limited');
  cache.put(throttleKey, '1', THROTTLE_SECONDS);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return buildError('server_busy');
  try {
    var ss = SpreadsheetApp.openById(prop_('SHEET_ID', ''));
    var sheet = ss.getSheetByName('codes');
    var rows = readRows_(sheet);
    var pick = pickAssignment(rows, v.email);
    if (pick.kind === 'existing') return buildSuccess(pick.code, true);
    if (pick.kind === 'sold_out') return buildError('sold_out');
    var rowNo = pick.index + 2;
    sheet.getRange(rowNo, 2, 1, 3).setValues([[v.email, name, nowStr_()]]);
    SpreadsheetApp.flush();
    return buildSuccess(pick.code, false);
  } finally {
    lock.releaseLock();
  }
}

function log_(email, name, result, reason) {
  try {
    var ss = SpreadsheetApp.openById(prop_('SHEET_ID', ''));
    var sheet = ss.getSheetByName('log');
    var outcome = result.ok ? (result.already_assigned ? 'ok_again' : 'ok_new') : result.error;
    sheet.appendRow([nowStr_(), email.slice(0, 100), outcome, reason, name]);
  } catch (err) {
    // ログ失敗で応答を止めない
  }
}
