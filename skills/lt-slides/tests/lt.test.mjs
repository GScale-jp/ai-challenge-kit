import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDeck, findOverflows } from '../scripts/check_deck.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));
const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url));
const fixture = (name) => join(fixtures, `deck.${name}.json`);

function run(script, ...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(scripts, script), ...args], { cwd: root, timeout: 55_000 });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

async function tempDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'lt-slides-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('7枚の HTML、16:9 の PDF、話す台本を作る', { timeout: 60_000 }, async (t) => {
  const outdir = await tempDirectory(t);
  const deck = JSON.parse(await readFile(fixture('good'), 'utf8'));
  const checked = await run('check_deck.mjs', '--deck', fixture('good'));
  assert.equal(checked.code, 0, checked.stderr || checked.signal);
  const result = await run('build_deck.mjs', '--deck', fixture('good'), '--outdir', outdir);
  assert.equal(result.code, 0, result.stderr || result.signal);
  assert.deepEqual((await readdir(outdir)).sort(), ['lt.html', 'lt.pdf', 'script.md']);
  const [html, pdf, script] = await Promise.all([
    readFile(join(outdir, 'lt.html'), 'utf8'),
    readFile(join(outdir, 'lt.pdf')),
    readFile(join(outdir, 'script.md'), 'utf8'),
  ]);
  assert.match(html, /https:\/\/cdn\.jsdelivr\.net\/npm\/reveal\.js@5\.1\.0\/dist\/reveal\.js/);
  assert.match(html, /reveal\.js@5\.1\.0\/plugin\/notes\/notes\.js/);
  for (const slide of deck.slides) {
    assert.ok(html.includes(`<aside class="notes">${slide.script}</aside>`));
    assert.ok(script.includes(`## ${slide.heading}（${slide.seconds}秒）`));
    assert.ok(script.includes(slide.script));
  }
  assert.ok(html.includes(`<a href="${deck.applyUrl}">`));
  assert.ok(html.includes(`<a href="${deck.demoUrl}">`));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const pdfText = pdf.toString('latin1');
  assert.match(pdfText, /\/CreationDate \(D:20000101000000\+00'00'\)/);
  assert.match(pdfText, /\/ModDate \(D:20000101000000\+00'00'\)/);
  assert.equal([...pdfText.matchAll(/\/Type\s*\/Page\b/g)].length, deck.slides.length);
  const pageSizes = [...pdfText.matchAll(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/g)];
  assert.equal(pageSizes.length, deck.slides.length);
  for (const [, width, height] of pageSizes) {
    assert.ok(Math.abs(width / height - 16 / 9) < 0.001, `PDF のページサイズ: ${width} × ${height}`);
  }
  const repeated = await run('build_deck.mjs', '--deck', fixture('good'), '--outdir', join(outdir, 'repeated'));
  assert.equal(repeated.code, 0, repeated.stderr || repeated.signal);
  for (const name of ['lt.html', 'lt.pdf', 'script.md']) {
    assert.deepEqual(await readFile(join(outdir, 'repeated', name)), await readFile(join(outdir, name)), name);
  }
});

const invalidDecks = [
  ['bad_time', /合計 360 秒.*300秒/],
  ['bad_text', /2枚目が 200 字.*120字以内/],
  ['bad_last', /最後のスライドに.*応募フォーム.*デモ/],
];
for (const [name, expected] of invalidDecks) {
  test(`${name} は原因を表示してファイルを作らない`, async (t) => {
    const directory = await tempDirectory(t);
    const outdir = join(directory, 'output');
    const checked = await run('check_deck.mjs', '--deck', fixture(name));
    const built = await run('build_deck.mjs', '--deck', fixture(name), '--outdir', outdir);
    for (const result of [checked, built]) {
      assert.equal(result.code, 1, result.stderr || result.signal);
      assert.match(result.stderr, expected);
    }
    await assert.rejects(access(outdir), { code: 'ENOENT' });
  });
}

test('文字や属性に埋め込まれた HTML をエスケープする', { timeout: 60_000 }, async (t) => {
  const outdir = await tempDirectory(t);
  const result = await run('build_deck.mjs', '--deck', fixture('xss'), '--outdir', outdir);
  assert.equal(result.code, 0, result.stderr || result.signal);
  const html = await readFile(join(outdir, 'lt.html'), 'utf8');
  assert.doesNotMatch(html, /<script>alert|href="javascript:| onfocus="alert/i);
  assert.match(html, /&lt;script&gt;alert\(&quot;body&quot;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;script&gt;alert\(&quot;notes&quot;\)&lt;\/script&gt;/);
  assert.match(html, /<title>画面の安全確認 &lt;script&gt;alert/);
  assert.match(html, /id="intro&quot; onfocus=&quot;alert\(1\)"/);
  const script = await readFile(join(outdir, 'script.md'), 'utf8');
  assert.ok(script.includes('&lt;script&gt;alert("notes")&lt;/script&gt;'));
});

test('必須項目、見出し、スライド枚数、URL を確認する', async () => {
  const deck = JSON.parse(await readFile(fixture('good'), 'utf8'));
  assert.deepEqual(checkDeck(deck), []);
  const sample = JSON.parse(await readFile(new URL('../templates/deck.sample.json', import.meta.url), 'utf8'));
  assert.deepEqual(checkDeck(sample), []);
  deck.slides = deck.slides.slice(0, 4);
  Object.assign(deck.slides[0], { id: '', heading: '挨拶。', script: '', seconds: 0 });
  Object.assign(deck, { title: '', demoUrl: '', applyUrl: 'https://example.com/form' });
  const violations = checkDeck(deck).join('\n');
  for (const expected of [/title/, /applyUrl/, /demoUrl/, /5〜10枚/, /id/, /見出し/, /script/, /seconds/]) {
    assert.match(violations, expected);
  }
});

test('スキルの名前と使いどきが正しく、禁止語が入っていない', async () => {
  const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /^---\r?\nname: lt-slides\r?\ndescription: [^\r\n]+と言われたとき、または \/ai-challenge-kit:lt-slides と入力されたときに使う。\r?\n---\r?\n/);
  assert.doesNotMatch(skill, /argon|codex|agy-run|gws|GScale|ジースケール/i);
});

test('英字まじりの長い見出しは1行に収まる大きさになり、はみ出しの検査を通る', { timeout: 60_000 }, async (t) => {
  const outdir = await tempDirectory(t);
  const checked = await run('check_deck.mjs', '--deck', fixture('latin_heading'));
  assert.equal(checked.code, 0, checked.stderr || checked.signal);
  assert.match(checked.stdout, /はみ出しもありません/);
  const built = await run('build_deck.mjs', '--deck', fixture('latin_heading'), '--outdir', outdir);
  assert.equal(built.code, 0, built.stderr || built.signal);
  const html = await readFile(join(outdir, 'lt.html'), 'utf8');
  const sizes = [...html.matchAll(/<h2 style="font-size:(\d+)px">/g)].map((match) => Number(match[1]));
  assert.equal(sizes.length, 7);
  assert.ok(sizes[4] < 52, `5枚目の見出しが縮んでいません: ${sizes[4]}`);
  assert.ok(sizes.every((size) => size >= 34 && size <= 52), sizes.join(','));
});

test('findOverflows は右端からはみ出した見出しを検出する', { timeout: 60_000 }, async (t) => {
  const { createRequire } = await import('node:module');
  const { chromium } = createRequire(join(scripts, 'x.js'))('playwright');
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
  await page.setContent('<section style="width:600px;height:300px;overflow:hidden"><h2 style="font-size:52px;white-space:nowrap;overflow:visible">Antigravity と Gemini を役割分担して使う</h2></section>');
  const problems = await findOverflows(page);
  assert.match(problems.join('\n'), /1枚目の見出しが右端ではみ出しています/);
  await page.setContent('<section style="width:600px;height:300px"><h2 style="font-size:30px">短い見出し</h2></section>');
  assert.deepEqual(await findOverflows(page), []);
});
