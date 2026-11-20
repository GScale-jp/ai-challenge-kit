const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { join } = require('node:path');
const { root, windows, psFlags, powerShells, cleanEnv } = require('./helpers');
const { startMockServer, passphrase, step, badMessage } = require('./mock-server');

const scripts = join(root, 'skills', 'voucher', 'scripts');
const env = { ...cleanEnv(/^AICK_(VOUCHER_URL|VOUCHER_CONFIG|TEST_(PASSPHRASE|EMAIL|NAME|SCRIPT))$/i),
  // 本番の設定（実 URL）を読まないよう、未設定のプレースホルダの設定を使う。
  AICK_VOUCHER_CONFIG: require('node:path').join(__dirname, 'fixtures', 'endpoints.placeholder.json') };
const name = 'テストの"名前"\\確認\n次の行';

function claim(executable, args, activeEnv) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { env: activeEnv, timeout: 30000, windowsHide: true }, (error, stdout, stderr) => {
      if (error && (typeof error.code !== 'number' || error.killed)) return reject(error);
      resolve({ status: error?.code ?? 0, stdout: stdout.replace(/\r\n/g, '\n'), stderr: stderr.replace(/\r\n/g, '\n') });
    });
  });
}

const shells = powerShells();
if (!shells.length) {
  test('配布クライアントの PowerShell を検出する', { skip: process.env.AICK_REQUIRE_PWSH !== '1' },
    () => assert.fail('指定した PowerShell が見つかりません。'));
}

const clients = shells.map((exe) => ({
  label: exe,
  invoke(url, phrase, email, useTest) {
    const script = join(scripts, 'claim.ps1');
    // Windows のプロセス引数の引用規則と切り離して、JSON にする入力をそのまま渡す。
    const command = '& $env:AICK_TEST_SCRIPT -Passphrase $env:AICK_TEST_PASSPHRASE -Email $env:AICK_TEST_EMAIL -Name $env:AICK_TEST_NAME' +
      (useTest ? ' -Test' : '') + '; exit $LASTEXITCODE';
    return claim(exe, [...psFlags, '-Command', command], {
      ...env, AICK_VOUCHER_URL: url, AICK_TEST_SCRIPT: script, AICK_TEST_PASSPHRASE: phrase,
      AICK_TEST_EMAIL: email, AICK_TEST_NAME: name,
    });
  },
}));
if (!windows) {
  clients.unshift({
    label: 'Bash',
    invoke(url, phrase, email, useTest) {
      return claim('/bin/bash', [join(scripts, 'claim.sh'), '--passphrase', phrase, '--email', email, '--name', name,
        ...(useTest ? ['--test'] : [])], { ...env, AICK_VOUCHER_URL: url });
    },
  });
}

for (const { label, invoke } of clients) {
  test(`配布クライアント ${label}`, async (t) => {
    const { server, url, requests } = await startMockServer();
    t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    const email = 'AICK.Test@GMAIL.COM';

    const result = await invoke(url, passphrase, email, false);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /クレジットコード: MOCK-1/);
    assert.ok(result.stdout.includes('1. ' + step), result.stdout);
    assert.match(result.stdout, /2\. 適用を確認する 🌧/);
    assert.match(result.stdout, /適用先: https:\/\/cloud.google.com\/redeem/);
    assert.match(result.stdout, /適用期限: \d{4}-\d{2}-\d{2}/);
    assert.match(result.stdout, /\nAICK_CODE=MOCK-1\n$/);
    assert.doesNotMatch(result.stdout, /すでに発行済み/);
    // 本物の GAS と同じく、最初の POST で処理し、転送先は本文なしの GET で取りに行く。
    assert.deepEqual(requests.map(({ method, path, body }) => [method, path, body]), [
      ['POST', '/', { passphrase, email: email.toLowerCase(), name }],
      ['GET', '/echo?t=1', undefined],
    ]);

    const again = await invoke(url, passphrase, email.toLowerCase(), true);
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /すでに発行済みのコードです/);
    assert.match(again.stdout, /\nAICK_CODE=MOCK-1\n$/);

    const wrong = await invoke(url, '違う合言葉', email, false);
    assert.equal(wrong.status, 1, wrong.stderr);
    assert.ok(wrong.stderr.includes(badMessage), wrong.stderr);

    const before = requests.length;
    const nonGmail = await invoke(url, passphrase, 'person@example.com', false);
    assert.equal(nonGmail.status, 2, nonGmail.stderr);
    assert.match(nonGmail.stderr, /クレジットは個人の Gmail/);

    for (const [endpoint, useTest] of [['', false], ['', true], ['__未設定__', true]]) {
      const unset = await invoke(endpoint, passphrase, email, useTest);
      assert.equal(unset.status, 3, unset.stderr);
      assert.match(unset.stderr, /配布用URLがまだ設定されていません/);
    }
    assert.equal(requests.length, before);

    const malformed = await invoke(url + '/malformed', passphrase, email, false);
    assert.equal(malformed.status, 1, malformed.stderr);
    assert.match(malformed.stderr, /応答を読み取れませんでした/);
    const disconnected = await invoke(url + '/disconnect', passphrase, email, false);
    assert.equal(disconnected.status, 4, disconnected.stderr);
    assert.match(disconnected.stderr, /接続できませんでした/);
  });
}
