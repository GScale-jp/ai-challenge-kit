/**
 * core.js: 検証・正規化・割り当て選択の純粋関数。GAS と Node の両方で読める。
 * GAS 固有の API（SpreadsheetApp など）はここに書かない。
 */

var CORE_VERSION = 1;
var DEFAULT_DEADLINE_ISO = '2026-11-21T00:00:00+09:00';
var DEFAULT_DEADLINE_LABEL = '2026-11-20';
var REDEEM_URL = 'https://cloud.google.com/redeem';
var GMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/;

var STEPS = [
  '1. 個人の Gmail で Google Cloud コンソールにログインし、請求先アカウントを有料アカウントにアップグレードする（クレジットの範囲内なら料金は発生しない）',
  '2. https://cloud.google.com/redeem を開き、このコードを入力する',
  '3. コンソールの［お支払い］>［クレジット］で適用されたことを確かめる',
  '4. 適用は 2026/11/20 まで。クレジットは適用日から1か月有効。超えた分は登録したお支払い方法に請求されるので、不要なリソースは削除する'
];

var MESSAGES = {
  bad_request: 'リクエストを読み取れませんでした。JSON で passphrase と email を送ってください。',
  bad_passphrase: '合言葉が違います。会場で伝えられた合言葉を確かめてください。',
  too_many_attempts: '合言葉の間違いが続いたため、しばらく受け付けられません。15分ほど待つか、運営に声をかけてください。',
  rate_limited: '短時間にくり返し送られました。10秒ほど待ってからもう一度送ってください。',
  not_gmail: 'クレジットは個人の Gmail アカウント（@gmail.com）にしか適用できません。会社・学校の Google Workspace アカウントでは適用できないため、個人の Gmail を指定してください。',
  closed: '受付は終了しました。',
  sold_out: '配布が終わりました。運営に声をかけてください',
  server_busy: '混み合っています。少し待ってからもう一度送ってください。',
  server_error: 'サーバー側でエラーが起きました。運営に声をかけてください。'
};

/** 前後の空白を除き、全角英数・記号を半角に寄せる（NFKC）。 */
function normalizeText(s) {
  if (s === null || s === undefined) return '';
  var t = String(s);
  if (typeof t.normalize === 'function') t = t.normalize('NFKC');
  return t.replace(/^\s+|\s+$/g, '');
}

function normalizeEmail(s) {
  return normalizeText(s).toLowerCase();
}

function isGmail(email) {
  return GMAIL_RE.test(email);
}

function passphraseMatches(input, expected) {
  var a = normalizeText(input);
  var b = normalizeText(expected);
  if (b === '') return false; // 未設定の合言葉では誰も通さない
  return a === b;
}

/** now が期限より前なら受付中。deadlineIso が壊れていたら安全側（受付終了）。 */
function isOpen(now, deadlineIso) {
  var d = new Date(deadlineIso || DEFAULT_DEADLINE_ISO).getTime();
  var n = (now instanceof Date) ? now.getTime() : new Date(now).getTime();
  if (isNaN(d) || isNaN(n)) return false;
  return n < d;
}

/**
 * 割り当ての選択。rows は codes タブのデータ行（ヘッダー除く）の配列で、
 * 各要素は {code, email}。email が空の行が未割り当て。
 * 戻り値: {kind:'existing', code} | {kind:'new', index, code} | {kind:'sold_out'}
 */
function pickAssignment(rows, email) {
  var i;
  for (i = 0; i < rows.length; i++) {
    if (rows[i].code && rows[i].email && normalizeEmail(rows[i].email) === email) {
      return { kind: 'existing', index: i, code: rows[i].code };
    }
  }
  for (i = 0; i < rows.length; i++) {
    if (rows[i].code && !normalizeText(rows[i].email)) {
      return { kind: 'new', index: i, code: rows[i].code };
    }
  }
  return { kind: 'sold_out' };
}

function countRemaining(rows) {
  var n = 0;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].code && !normalizeText(rows[i].email)) n++;
  }
  return n;
}

function buildError(error) {
  return { ok: false, error: error, message: MESSAGES[error] || MESSAGES.server_error };
}

function buildSuccess(code, alreadyAssigned) {
  return {
    ok: true,
    code: code,
    already_assigned: !!alreadyAssigned,
    redeem_url: REDEEM_URL,
    deadline: DEFAULT_DEADLINE_LABEL,
    steps: STEPS.slice()
  };
}

/**
 * 入力検査（合言葉・期限・email）を順に行い、通れば {ok:true, email}、
 * 落ちれば {ok:false, error}。レート制限と合言葉誤りの回数は呼び出し側が持つ。
 * 合言葉の誤りが上限を超えているときは attemptsExceeded=true を渡す。
 */
function validateRequest(req, ctx) {
  if (!req || typeof req !== 'object') return { ok: false, error: 'bad_request' };
  var email = normalizeEmail(req.email);
  if (!email) return { ok: false, error: 'bad_request', email: '' };
  if (ctx.attemptsExceeded) return { ok: false, error: 'too_many_attempts', email: email };
  if (!isOpen(ctx.now, ctx.deadlineIso)) return { ok: false, error: 'closed', email: email };
  if (!passphraseMatches(req.passphrase, ctx.passphrase)) return { ok: false, error: 'bad_passphrase', email: email };
  if (!isGmail(email)) return { ok: false, error: 'not_gmail', email: email };
  return { ok: true, email: email };
}

if (typeof module !== 'undefined') {
  module.exports = {
    STEPS: STEPS, MESSAGES: MESSAGES, DEFAULT_DEADLINE_ISO: DEFAULT_DEADLINE_ISO,
    normalizeText: normalizeText, normalizeEmail: normalizeEmail, isGmail: isGmail,
    passphraseMatches: passphraseMatches, isOpen: isOpen, pickAssignment: pickAssignment,
    countRemaining: countRemaining, buildError: buildError, buildSuccess: buildSuccess,
    validateRequest: validateRequest
  };
}
