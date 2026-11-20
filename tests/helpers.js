const { spawnSync } = require('node:child_process');
const { existsSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const windows = process.platform === 'win32';
const psFlags = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass'];
const fakeAgy = join(__dirname, 'fixtures', windows ? 'fake-agy.cmd' : 'fake-agy');

function canRun(executable) {
  return spawnSync(executable, [...psFlags, '-Command', 'exit 0'], { timeout: 15000 }).status === 0;
}

function powerShells() {
  if (process.env.AICK_PS_EXE) {
    return canRun(process.env.AICK_PS_EXE) ? [process.env.AICK_PS_EXE] : [];
  }
  const pwsh = ['pwsh', '/opt/homebrew/bin/pwsh'].find(canRun);
  if (!pwsh && process.env.AICK_REQUIRE_PWSH === '1') return [];
  const legacy = windows && [join(process.env.SystemRoot || 'C:\\Windows',
    'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), 'powershell.exe'].find(canRun);
  return [pwsh, legacy].filter(Boolean);
}

function cleanEnv(prefix) {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !prefix.test(name)));
}

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'aick-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function run(command, args, env, input = '') {
  const result = spawnSync(command, args, {
    cwd: root, env, input, encoding: 'utf8', timeout: 30000,
  });
  if (result.error) throw result.error;
  return { ...result, output: result.stdout + result.stderr };
}

function makeInstallEnv(t) {
  const home = tempDir(t);
  const env = {
    ...cleanEnv(/^(AICK_|AGY_BIN$|FAKE_AGY_)/i),
    AGY_BIN: fakeAgy,
    AICK_SOURCE: root,
    AICK_HOME: join(home, '作業フォルダ'),
    FAKE_AGY_LOG: join(home, 'agy.log'),
    FAKE_AGY_SEEN: join(home, 'agy.seen'),
  };
  return { env, home };
}

module.exports = { root, windows, psFlags, fakeAgy, powerShells, cleanEnv, run, makeInstallEnv, existsSync };
