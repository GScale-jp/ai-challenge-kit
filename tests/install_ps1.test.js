const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, delimiter } = require('node:path');
const { root, windows, psFlags, fakeAgy, powerShells, makeInstallEnv, run, existsSync } = require('./helpers');

const script = join(root, 'install', 'install.ps1');
// ローカルのソースは一時コピーに差し替わって入る（.e2e-out などを除くため）。パスは <copy> にそろえる。
const calls = (env) => readFileSync(env.FAKE_AGY_LOG, 'utf8').trim().split(/\r?\n/)
  .map((line) => (/^plugin install .*[\\/]ai-challenge-kit$/.test(line) ? 'plugin install <copy>' : line));
const seen = (env) => readFileSync(env.FAKE_AGY_SEEN, 'utf8').split(/\r?\n/).filter(Boolean);
const shells = powerShells();
const required = process.env.AICK_REQUIRE_PWSH === '1';

test('PowerShell インストーラ', { skip: !shells.length && !required ? 'PowerShell が見つかりません。' : false }, async (t) => {
  assert.ok(shells.length, '指定した PowerShell が見つかりません。');
  for (const exe of shells) {
    await t.test(exe, async (t) => {
      const install = (env) => run(exe, [...psFlags, '-File', script], env);

      for (const viaIex of [false, true]) {
        await t.test(viaIex ? '取得した本文を iex に渡す' : 'ローカルから入れて次の操作を表示する', (t) => {
          const { env } = makeInstallEnv(t);
          const result = viaIex
            ? run(exe, [...psFlags, '-Command', 'Get-Content -Encoding UTF8 -Raw -LiteralPath $env:AICK_INSTALL_SCRIPT | iex'],
              { ...env, AICK_INSTALL_SCRIPT: script })
            : install(env);
          assert.equal(result.status, 0, result.output);
          assert.deepEqual(calls(env), ['plugin list', 'plugin install <copy>']);
          assert.ok(existsSync(env.AICK_HOME));
          const names = seen(env);
          assert.ok(names.includes('plugin.json') && names.includes('skills'), names.join(','));
          for (const excluded of ['.e2e-out', '.git', 'node_modules']) assert.ok(!names.includes(excluded), excluded);
          assert.match(result.output, /cd .*agy.*\/ai-challenge-kit:challenge/);
        });
      }

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
        const result = install({ ...env, AICK_UNINSTALL: '1' });
        assert.equal(result.status, 0, result.output);
        assert.deepEqual(calls(env), ['plugin uninstall ai-challenge-kit']);
        assert.equal(readFileSync(marker, 'utf8'), '作成物');
        assert.match(result.output, /削除せず/);
      });

      for (const yes of [true, false]) {
        await t.test(yes ? '承認済みなら agy を導入して再探索する' : '端末と AICK_YES が無い場合は失敗する', (t) => {
          const { env, home } = makeInstallEnv(t);
          const isolated = Object.fromEntries(Object.entries(env).filter(([key]) => !/^path$/i.test(key)));
          Object.assign(isolated, {
            AGY_BIN: '', HOME: home, LOCALAPPDATA: home,
            PATH: windows ? [join(process.env.SystemRoot, 'System32'), join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0')].join(delimiter)
              : '/usr/bin:/bin',
            AICK_YES: yes ? '1' : '',
            AICK_AGY_INSTALLER_CMD: '$env:AGY_BIN = $env:FAKE_AGY_FIXTURE',
            FAKE_AGY_FIXTURE: fakeAgy,
          });
          // PATH を隔離する前に PowerShell 本体の絶対パスを解決する。
          const resolved = windows
            ? run(exe, [...psFlags, '-Command', '(Get-Process -Id $PID).Path'], env)
            : run('/usr/bin/which', [exe], env);
          assert.equal(resolved.status, 0, resolved.output);
          const absoluteExe = resolved.stdout.trim();
          const result = run(absoluteExe, [...psFlags, '-File', script], isolated);
          if (yes) {
            assert.equal(result.status, 0, result.output);
            assert.match(result.output, /agy をインストールします/);
            assert.deepEqual(calls(env), ['plugin list', 'plugin install <copy>']);
          } else {
            assert.notEqual(result.status, 0, result.output);
            assert.match(result.output, /AICK_YES=1/);
            assert.ok(!existsSync(env.FAKE_AGY_LOG));
          }
        });
      }
    });
  }
});
