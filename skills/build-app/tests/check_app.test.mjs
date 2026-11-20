import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skillDir = fileURLToPath(new URL('../', import.meta.url));
const script = join(skillDir, 'scripts', 'check_app.mjs');
const fixture = name => join(skillDir, 'tests', 'fixtures', name);

function run(...args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 90000 });
}

test('エラーの無いページは成功し、スクリーンショットを保存する', t => {
  const dir = mkdtempSync(join(tmpdir(), 'check-app-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const png = join(dir, 'nested', 'app.png');
  const result = run(fixture('ok.html'), png);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(png) && readFileSync(png).length > 100);
});

test('コンソールやページのエラーがあれば失敗する', () => {
  const result = run(fixture('error.html'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /わざと出したエラー/);
});

test('存在しないファイルは失敗する', () => {
  const result = run(fixture('none.html'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /見つかりません/);
});

test('SKILL.md は点検リストと公式ドキュメントでの確認を含む', () => {
  const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  assert.match(skill, /公式ドキュメントで確かめる/);
  assert.match(skill, /AI が書いたコードの点検リスト/);
  assert.match(skill, /gas-app/);
  assert.match(skill, /prototype_check\.md/);
  assert.match(skill, /画面での確認は未実施/);
  assert.match(skill, /gemini-3\.8-flash/);
});
