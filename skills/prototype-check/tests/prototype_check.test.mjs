import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skillDir = fileURLToPath(new URL('../', import.meta.url));
const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');

test('スキルの名前、説明、チェックリストの参照がそろっている', () => {
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skill);
  assert.ok(frontMatter);
  assert.equal(/^name: (\S+)$/m.exec(frontMatter[1])?.[1], basename(skillDir));
  assert.match(frontMatter[1], /^description: .+と言われたとき、または \/ai-challenge-kit:prototype-check と入力されたときに使う。$/m);
  assert.match(skill, /\breferences\/checklist\.md\b/);
  assert.ok(readFileSync(join(skillDir, 'references', 'checklist.md'), 'utf8').trim());
});

test('点検結果の固定見出しが指定の順番で案内されている', () => {
  const headings = [...skill.matchAll(/^   - `(#{1,2} [^`]+)`/gm)].map(([, heading]) => heading);
  assert.deepEqual(headings, [
    '# 試作の点検', '## 結論', '## 作る形', '## 今日2時間で動くか', '## 動画で見せる場面',
    '## 審査基準', '## 危ういところと直し方', '## 機密・個人情報',
  ]);
});

test('スキル内の Markdown に社内用語がない', () => {
  for (const file of readdirSync(skillDir, { recursive: true }).filter(name => name.endsWith('.md'))) {
    assert.doesNotMatch(readFileSync(join(skillDir, file), 'utf8'), /argon|codex|agy-run|gws|GScale|ジースケール/i, file);
  }
});
