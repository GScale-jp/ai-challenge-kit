const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { root } = require('./helpers');

const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const skillRoot = join(root, 'skills');
const expected = ['challenge', 'idea-spark', 'prototype-check', 'kabeuchi', 'build-app', 'deploy', 'demo-video',
  'make-video', 'entry-form', 'entry-submit', 'lt-slides', 'voucher'];

function field(frontMatter, key) {
  const match = frontMatter.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  assert.ok(match, `front matter に ${key} がありません。`);
  const continuation = frontMatter.slice(match.index + match[0].length).match(/^(?:\n(?:[ \t]+[^\n]*|(?=\n)))+/)?.[0].trim() || '';
  const scalar = match[1].trim();
  if (/^[|>][1-9+-]{0,2}(?:\s+#.*)?$/.test(scalar)) return continuation;
  if (scalar.startsWith('"')) return JSON.parse(scalar.match(/^"(?:[^"\\]|\\.)*"/)?.[0]);
  if (scalar.startsWith("'")) return scalar.match(/^'((?:[^']|'')*)'/)?.[1].replace(/''/g, "'");
  return [scalar.replace(/\s+#.*$/, ''), continuation].filter(Boolean).join(' ');
}

test('プラグインのマニフェストとロゴ', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'ai-challenge-kit');
  for (const key of ['displayName', 'description', 'version', 'logo']) {
    assert.ok(typeof manifest[key] === 'string' && manifest[key].trim(), `${key} が空です。`);
  }
  assert.ok(statSync(join(root, manifest.logo)).isFile(), 'ロゴファイルを確認できません。');
  assert.ok(Array.isArray(manifest.suggestedPrompts) && manifest.suggestedPrompts.length <= 3,
    'suggestedPrompts は3つ以下の配列にしてください。');
  assert.ok((typeof manifest.repository === 'string' && manifest.repository.trim()) ||
    (typeof manifest.repository?.url === 'string' && manifest.repository.url.trim()), 'repository が空です。');
});

test('必要な12スキルがそろっている', () => {
  const missing = expected.filter((name) => !existsSync(join(skillRoot, name, 'SKILL.md')));
  assert.deepEqual(missing, [], `SKILL.md がありません: ${missing.join('、')}`);
});

for (const skill of readdirSync(skillRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  const dir = join(skillRoot, skill.name);
  const skillFile = join(dir, 'SKILL.md');
  if (!existsSync(skillFile)) continue;
  test(`${skill.name} の front matter、本文、参照ファイル`, () => {
    const doc = readFileSync(skillFile, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const parts = doc.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*\n([\s\S]*)$/);
    assert.ok(parts, '先頭に YAML front matter がありません。');
    const [, frontMatter, body] = parts;
    assert.equal(field(frontMatter, 'name'), skill.name);
    assert.match(field(frontMatter, 'description'), japanese);
    assert.match(body, japanese);
    const paths = new Set([...body.matchAll(/(?:^|[^\w/])((?:(?:\.{1,2}|[\p{L}\p{N}_.-]+)\/)*(?:references|scripts)\/(?:[\p{L}\p{N}_.-]+\/)*[\p{L}\p{N}_-][\p{L}\p{N}_.-]*)/gu)]
      .map((match) => match[1].replace(/\.+$/, '')));
    for (const path of paths) {
      const file = join(dir, path);
      assert.ok(existsSync(file) && statSync(file).isFile(), `参照ファイルがありません: ${path}`);
    }
  });
}

test('共通ルールに日本語が含まれる', () => {
  assert.match(readFileSync(join(root, 'rules', 'AGENTS.md'), 'utf8'), japanese);
});

test('案内のスキル名は、実際に登録される /ai-challenge-kit:<名前> の形で書かれている', () => {
  // agy 1.5.12 では、スキルは /ai-challenge-kit:challenge のようにプラグイン名つきで登録される。
  // 「/challenge」だけを案内すると、補完で別のスキルが入って「Unknown command」になる。
  const bare = new RegExp(`(?<![\\w:./\\\\-])/(?:${expected.join('|')})(?![\\w/.-])`);
  const files = ['README.md', 'plugin.json', 'rules/AGENTS.md', 'install/install.sh', 'install/install.ps1',
    ...expected.flatMap((name) => ['SKILL.md', ...['references']
      .flatMap((sub) => existsSync(join(skillRoot, name, sub))
        ? readdirSync(join(skillRoot, name, sub)).map((file) => `${sub}/${file}`) : [])]
      .map((file) => `skills/${name}/${file}`))];
  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8').replace('（`/challenge` だけでは動きません）', '');
    assert.doesNotMatch(text, bare, `${file} に、プラグイン名のないスキル名があります。`);
  }
});

test('/voucher は絶対パスでスクリプトを呼ぶ手順になっている', () => {
  const text = readFileSync(join(skillRoot, 'voucher', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(text, /bash scripts\/claim\.sh --/);
  assert.match(text, /bash "<スキルのフォルダ>\/scripts\/claim\.sh"/);
});
