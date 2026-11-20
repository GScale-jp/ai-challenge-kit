import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { once } from 'node:events';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { finished } from 'node:stream/promises';

const [stage, outputFile, answersFile, stopFile] = process.argv.slice(2);
const timeout = Number(process.env.AICK_E2E_TIMEOUT || 300);
const prompts = answersFile
  ? readFileSync(answersFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  : [`/${stage}`];
if (stage === 'voucher') {
  prompts[0] = [
    '/ai-challenge-kit:voucher',
    'E2E 検証です。環境変数 AICK_VOUCHER_URL に指定したテスト API にだけ接続し、テスト用コードの取得結果を AICK_CODE= で示してください。コードを適用する操作は実行しないでください。',
    '合言葉とメールは実行環境の AICK_E2E_VOUCHER_PASSPHRASE と AICK_E2E_VOUCHER_EMAIL を使ってください。',
  ].join('\n');
}

if (!prompts.length || !Number.isSafeInteger(timeout) || timeout <= 0) {
  console.error('回答または AICK_E2E_TIMEOUT の設定が無効です。');
  process.exit(1);
}

const log = createWriteStream(outputFile);
const errors = createWriteStream(outputFile.replace(/\.ndjson$/, '.stderr.log'));
const streamEnv = { ...process.env };
if (stage !== 'voucher') {
  delete streamEnv.AICK_VOUCHER_URL;
  delete streamEnv.AICK_E2E_VOUCHER_PASSPHRASE;
  delete streamEnv.AICK_E2E_VOUCHER_EMAIL;
} else {
  streamEnv.AICK_E2E_VOUCHER_PASSPHRASE ||= 'E2E-TEST';
  streamEnv.AICK_E2E_VOUCHER_EMAIL ||= 'aick.e2e.fixture@gmail.com';
}
// 【--dangerously-skip-permissions を使う理由】
// ヘッドレスでは権限確認に答えられない。--mode accept-edits だけでは write_file が拒否され、
// --settings の allow で write_file を実パスで許可しても、スキルが実行するシェルコマンド
// （ls や mkdir など）の許可は完全一致しか効かず、事前に列挙できないため、通しの検査ができない。
// 条件: ①作業フォルダは run_e2e.sh が作る mktemp の一時フォルダだけ ②HOME 直下・~/.gemini・リポ本体では動かさない
// （下の検査で止める）。この検査用の指定であり、参加者向けの README・スキル・インストーラには書かない。
const workspaceReal = realpathSync(process.cwd());
const home = realpathSync(process.env.HOME || '/nonexistent');
const underTmp = /^\/(private\/)?(var\/folders\/[^/]+\/[^/]+\/T|tmp)\/tmp\.[^/]+(\/|$)/.test(workspaceReal + '/') ;
if (!underTmp || workspaceReal === home || workspaceReal.startsWith(home + '/.gemini')) {
  throw new Error('E2E の作業フォルダが mktemp の一時フォルダではありません: ' + workspaceReal);
}
const child = spawn('env', [
  '-u', 'AGY_ADC_AUTH', 'agy', '-p=', '--input-format', 'stream-json',
  '--output-format', 'stream-json', '--mode', 'accept-edits', '--dangerously-skip-permissions', '--print-timeout', `${timeout}s`,
], { env: streamEnv, detached: true });
child.stderr.pipe(errors);
child.stdin.on('error', () => {});
const closed = once(child, 'close');
closed.catch(() => {});
const lines = createInterface({ input: child.stdout });
const results = lines[Symbol.asyncIterator]();
const missingSkill = /(?:unknown|unrecognized|unsupported|no such) (?:slash )?(?:command|skill)|(?:command|skill) [^\n]{0,100}not found|(?:コマンド|スキル)(?:が|は)?(?:見つかりません|存在しません|利用できません|認識されません)|不明な(?:コマンド|スキル)/i;

function stopChild() {
  if (!child.pid) return;
  try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { stopChild(); process.exit(1); });
}

async function nextResponse() {
  for (;;) {
    const { done, value: line } = await results.next();
    if (done) break;
    log.write(line + '\n');
    let event;
    try { event = JSON.parse(line); } catch { throw new Error('agy から JSON 以外の出力を受け取りました。'); }
    if (event.event !== 'result') continue;
    const { status, response, error } = event.result || {};
    if (status !== 'SUCCESS' || typeof response !== 'string' || !response.trim() || missingSkill.test(response)) {
      throw new Error(`agy の応答を確認できませんでした（${error || status || '結果なし'}）。`);
    }
    return response;
  }
  await closed;
  throw new Error('agy が結果を返す前に終了しました。');
}

const timer = setTimeout(() => {
  console.error(`agy の実行が ${timeout} 秒を超えました。`);
  process.exitCode = 1;
  stopChild();
}, timeout * 1000);

try {
  let response;
  for (const prompt of prompts) {
    child.stdin.write(JSON.stringify({ event: 'user', message: { content: prompt } }) + '\n');
    response = await nextResponse();
    if (stopFile && existsSync(stopFile)) break;
  }
  if (stage === 'voucher' && !/(?:^|\s|`)AICK_CODE=[^\s`<>]+/m.test(response || '')) {
    throw new Error('テスト用コードの取得結果が見つかりません。');
  }
  child.stdin.end();
  for await (const line of { [Symbol.asyncIterator]: () => results }) log.write(line + '\n');
  const [status] = await closed;
  if (status !== 0) throw new Error(`agy が異常終了しました（終了コード ${status}）。`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
  stopChild();
  await closed.catch(() => {});
} finally {
  clearTimeout(timer);
  log.end();
  await Promise.all([finished(log), finished(errors)]);
}
