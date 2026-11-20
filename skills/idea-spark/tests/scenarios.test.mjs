import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skillDir = fileURLToPath(new URL('../', import.meta.url));
const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
const scenarios = readFileSync(join(skillDir, 'references', 'scenarios.md'), 'utf8');
const sections = [...scenarios.matchAll(/^## シナリオ ([1-9]\d*): (\S[^\r\n]*)\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
const fields = [
  '誰が', 'どんな場面', '困りごと', 'AI で何が変わる',
  '部門', '作るなら最小の形', '審査基準でのひとこと',
];
const categories = ['暮らしと家族', 'はたらく・まなぶ', 'まちと地球の未来'];
const appTypes = ['GAS Web アプリ', '静的 Web アプリ', 'Cloud Run'];

test('シナリオは連番で14本あり、7項目が指定の順番で埋まっている', () => {
  assert.equal(sections.length, 14);
  for (const [index, [, number, , body]] of sections.entries()) {
    assert.equal(Number(number), index + 1);
    const items = [...body.matchAll(/^- ([^:\r\n]+): (\S[^\r\n]*)/gm)];
    assert.deepEqual(items.map(([, field]) => field), fields, `シナリオ ${number}`);
  }
});

test('各部門は3本以上、最小の形は各2本以上ある', () => {
  const categoryCounts = new Map(categories.map(name => [name, 0]));
  const appTypeCounts = new Map(appTypes.map(name => [name, 0]));
  for (const [, number, , body] of sections) {
    const category = /^- 部門: (.+)$/m.exec(body)?.[1].trim();
    assert.ok(categoryCounts.has(category), `シナリオ ${number} の部門`);
    categoryCounts.set(category, categoryCounts.get(category) + 1);
    const form = /^- 作るなら最小の形: (.+)$/m.exec(body)?.[1].trim();
    const appType = appTypes.find(name => form?.startsWith(name) && form.length > name.length);
    assert.ok(appType, `シナリオ ${number} の最小の形`);
    appTypeCounts.set(appType, appTypeCounts.get(appType) + 1);
  }
  for (const [category, count] of categoryCounts) assert.ok(count >= 3, category);
  for (const [type, count] of appTypeCounts) assert.ok(count >= 2, type);
});

test('スキルの名前、説明、シナリオの参照がそろっている', () => {
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skill);
  assert.ok(frontMatter);
  assert.equal(/^name: (\S+)$/m.exec(frontMatter[1])?.[1], basename(skillDir));
  assert.match(frontMatter[1], /^description: .+と言われたとき、または \/ai-challenge-kit:idea-spark と入力されたときに使う。$/m);
  assert.match(skill, /\breferences\/scenarios\.md\b/);
});

test('スキル内の Markdown に社内用語がない', () => {
  for (const file of readdirSync(skillDir, { recursive: true }).filter(name => name.endsWith('.md'))) {
    assert.doesNotMatch(readFileSync(join(skillDir, file), 'utf8'), /argon|codex|agy-run|gws|GScale|ジースケール/i, file);
  }
});
