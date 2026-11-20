const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { root, windows, fakeAgy, makeInstallEnv, run, existsSync } = require('./helpers');

const script = join(root, 'install', 'install.sh');
const install = (env, ...args) => run('/bin/bash', [script, ...args], env);
// ローカルのソースは一時コピーに差し替わって入る（.e2e-out などを除くため）。パスは <copy> にそろえる。
const calls = (env) => readFileSync(env.FAKE_AGY_LOG, 'utf8').trim().split(/\r?\n/)
  .map((line) => (/^plugin install .*[\\/]ai-challenge-kit$/.test(line) ? 'plugin install <copy>' : line));
const seen = (env) => readFileSync(env.FAKE_AGY_SEEN, 'utf8').split(/\r?\n/).filter(Boolean);

test('Bash インストーラ', { skip: windows }, async (t) => {
  await t.test('ローカルから入れて次の操作を表示する', (t) => {
    const { env } = makeInstallEnv(t);
    const result = install(env);
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(calls(env), ['plugin list', 'plugin install <copy>']);
    assert.ok(existsSync(env.AICK_HOME));
    const names = seen(env);
    assert.ok(names.includes('plugin.json') && names.includes('skills'), names.join(','));
    for (const excluded of ['.e2e-out', '.git', 'node_modules']) assert.ok(!names.includes(excluded), excluded);
    assert.match(result.output, /cd .*agy.*\/ai-challenge-kit:challenge/);
  });

  for (const [label, settings, firstAttempt] of [
    ['一覧にあるプラグインを入れ直す', { FAKE_AGY_INSTALLED: '1' }, []],
    ['一覧の失敗後も既存エラーから入れ直す',
      { FAKE_AGY_LIST_FAIL: '1', FAKE_AGY_CONFLICT: '1' }, ['plugin install <copy>']],
  ]) {
    await t.test(label, (t) => {
      const { env } = makeInstallEnv(t);
      Object.assign(env, settings);
      const result = install(env);
      assert.equal(result.status, 0, result.output);
      assert.deepEqual(calls(env), ['plugin list', ...firstAttempt, 'plugin uninstall ai-challenge-kit', 'plugin install <copy>']);
    });
  }

  await t.test('アンインストールでも作業内容を残す', (t) => {
    const { env } = makeInstallEnv(t);
    mkdirSync(env.AICK_HOME);
    const marker = join(env.AICK_HOME, '作成物.txt');
    writeFileSync(marker, '作成物');
    const result = install(env, '--uninstall');
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(calls(env), ['plugin uninstall ai-challenge-kit']);
    assert.equal(readFileSync(marker, 'utf8'), '作成物');
    assert.match(result.output, /削除せず/);
  });

  for (const yes of [true, false]) {
    await t.test(yes ? 'パイプ実行の --yes で agy を導入して再探索する' : '端末と --yes が無い場合は失敗する', (t) => {
      const { env, home } = makeInstallEnv(t);
      Object.assign(env, {
        AGY_BIN: '', HOME: home, PATH: '/usr/bin:/bin',
        FAKE_AGY_FIXTURE: fakeAgy,
        AICK_AGY_INSTALLER_CMD: 'mkdir -p "$HOME/.local/bin" && cp "$FAKE_AGY_FIXTURE" "$HOME/.local/bin/agy"',
      });
      const result = run('/bin/bash', yes ? ['-s', '--', '--yes'] : ['-s'], env, readFileSync(script));
      if (yes) {
        assert.equal(result.status, 0, result.output);
        assert.match(result.output, /agy をインストールします/);
        assert.deepEqual(calls(env), ['plugin list', 'plugin install <copy>']);
        assert.ok(existsSync(env.AICK_HOME));
      } else {
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, /--yes/);
        assert.ok(!existsSync(env.FAKE_AGY_LOG));
      }
    });
  }
});

test('Bash インストーラ（Cloud Shell）', { skip: windows }, async (t) => {
  await t.test('Cloud Shell ではログインとウェブでプレビューを案内する', (t) => {
    const { env } = makeInstallEnv(t);
    Object.assign(env, { CLOUD_SHELL: 'true', AICK_SKIP_PLAYWRIGHT: '1' });
    const result = install(env);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /Google OAuth/);
    assert.match(result.output, /ウェブでプレビュー/);
  });
});
