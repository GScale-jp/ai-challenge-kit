import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium, parseScenes, totalSeconds, validate } from '../scripts/make_video.mjs';

const require = createRequire(new URL('../scripts/package.json', import.meta.url));
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const cli = join(root, 'skills', 'make-video', 'scripts', 'make_video.mjs');
const good = fileURLToPath(new URL('./fixtures/video_script.md', import.meta.url));
const tooLong = fileURLToPath(new URL('./fixtures/video_script_too_long.md', import.meta.url));

function run(...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: root, timeout: 55_000 });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

async function tempDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'make-video-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function videoDuration(file) {
  const browser = await launchChromium(chromium);
  try {
    const page = await browser.newPage();
    // file:// のページとして WebM を開き、そのファイルを video 要素に読み込みます。
    const url = pathToFileURL(file).href;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return await page.evaluate(async (src) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      document.body.replaceChildren(video);
      const metadata = new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', resolve, { once: true });
        video.addEventListener('error', () => reject(new Error('WebM を再生できません。')), { once: true });
      });
      video.src = src;
      let timer;
      const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), 5000); });
      const duration = (async () => {
        await metadata;
        const seeked = new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true }));
        video.currentTime = Number.isFinite(video.duration) ? video.duration : 1e101;
        await seeked;
        if (Number.isFinite(video.duration)) return video.duration;
        return new Promise((resolve) => {
          video.addEventListener('durationchange', () => {
            if (Number.isFinite(video.duration)) resolve(video.duration);
          });
        });
      })();
      try {
        return await Promise.race([duration, timeout]);
      } finally {
        clearTimeout(timer);
      }
    }, url);
  } finally {
    await browser.close();
  }
}

test('ダミーアプリを操作して90秒以内の WebM を作る', { timeout: 60_000 }, async (t) => {
  const directory = await tempDirectory(t);
  const output = join(directory, 'result.webm');
  const start = performance.now();
  const result = await run('--script', good, '--out', output, '--width', '640', '--height', '360');
  const elapsed = (performance.now() - start) / 1000;
  assert.equal(result.code, 0, result.stderr || result.signal);
  const contents = await readFile(output);
  assert.ok(contents.length > 4);
  assert.deepEqual(contents.subarray(0, 4), Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  assert.match(result.stdout, /0 秒から: 導入/);
  assert.match(result.stdout, /3 秒から: problem/);
  assert.match(result.stdout, /7 秒から: demo/);
  assert.match(result.stdout, /16 秒から: wrapup/);
  assert.match(result.stdout, /合計 20 秒/);
  assert.match(result.stdout, /動画の長さ: \d|録画の実測/);

  const duration = await videoDuration(output);
  if (duration === null) {
    t.diagnostic(`ブラウザで長さを取得できなかったため、録画コマンドの実測 ${elapsed.toFixed(2)} 秒を使用`);
    assert.ok(elapsed >= 19 && elapsed <= 90, `実測: ${elapsed}秒`);
  } else {
    t.diagnostic(`WebM の長さ: ${duration.toFixed(2)} 秒`);
    assert.ok(duration >= 19 && duration <= 90, `WebM の長さ: ${duration}秒`);
  }

  await t.test('画面録画を指定して導入に差し込む', async () => {
    const script = join(directory, 'with clip.md');
    const withClip = join(directory, 'with clip.webm');
    const data = parseScenes(await readFile(good, 'utf8'));
    data.antigravityClip = output;
    for (const scene of data.scenes) {
      scene.seconds = 0.5;
      delete scene.steps;
    }
    await writeFile(script, `## 自動作成用の場面データ\n\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\`\n`);
    const result = await run('--script', script, '--out', withClip, '--width', '640', '--height', '360');
    assert.equal(result.code, 0, result.stderr || result.signal);
    assert.match(result.stdout, /3 秒から: problem/);
    assert.match(result.stdout, /合計 4.5 秒/);
    assert.deepEqual((await readFile(withClip)).subarray(0, 4), contents.subarray(0, 4));
  });
});

test('localhost のアプリを録画用ページの iframe に表示する', { timeout: 60_000 }, async () => {
  const browser = await launchChromium(chromium);
  try {
    const page = await browser.newPage();
    const appUrl = 'http://localhost:8080/';
    const path = fileURLToPath(new URL('./fixtures/dummy_app/index.html', import.meta.url));
    // ローカルサーバーを起動せず、Chromium に届く HTTP の応答を用意します。
    await page.route(appUrl, (route) => route.fulfill({ path }));
    await page.goto(new URL('../templates/scene.html', import.meta.url).href);
    await page.evaluate((url) => {
      window.showScene({ title: '操作', caption: '追加します', mode: 'demo' });
      window.showApp(url);
      window.compactOverlay();
    }, appUrl);
    const frame = page.frameLocator('#app');
    assert.equal(await frame.locator('h1').textContent({ timeout: 10_000 }), '備えのリスト');
    await frame.locator('#add').click({ timeout: 10_000 });
    assert.equal(await frame.locator('#name').isVisible(), true);
  } finally {
    await browser.close();
  }
});

test('95秒の台本は録画せず、どの場面を何秒縮めるか知らせる', async (t) => {
  const directory = await tempDirectory(t);
  const output = join(directory, 'result.webm');
  const result = await run('--script', tooLong, '--out', output);
  assert.equal(result.code, 1, result.stderr || result.signal);
  assert.match(result.stderr, /95 秒.*90秒を超えています/);
  assert.match(result.stderr, /「demo」を 84 秒から 79 秒に縮めて/);
  assert.equal(result.stdout, '');
  await assert.rejects(access(output), { code: 'ENOENT' });
});

test('秒数の検査だけを実行できる', async (t) => {
  const directory = await tempDirectory(t);
  const output = join(directory, 'result.webm');
  const result = await run('--script', good, '--out', output, '--check-only');
  assert.equal(result.code, 0, result.stderr || result.signal);
  assert.match(result.stdout, /合計 20 秒/);
  await assert.rejects(access(output), { code: 'ENOENT' });
});

test('台本末尾の場面データを読み取り、秒数と操作の違反を検出する', async () => {
  const markdown = await readFile(good, 'utf8');
  const data = parseScenes(markdown.replaceAll('\n', '\r\n'));
  assert.deepEqual(validate(data), []);
  assert.equal(totalSeconds(data), 20);
  assert.equal(totalSeconds({ scenes: data.scenes }), 25);
  const exactly90 = structuredClone(data);
  exactly90.scenes[1].seconds += 70;
  assert.deepEqual(validate(exactly90), []);
  assert.throws(() => parseScenes('# 台本'), /場面データ/);
  assert.throws(() => parseScenes(markdown.replace('"appUrl":', 'appUrl:')), /JSON/);
  assert.throws(() => parseScenes(markdown + '\n続き'), /末尾/);
  data.scenes[0].seconds = 0;
  data.scenes[1].id = data.scenes[0].id;
  data.scenes[1].steps.push({ action: 'submit' });
  const violations = validate(data).join('\n');
  assert.match(violations, /秒数.*正の数/);
  assert.match(violations, /id.*重複/);
  assert.match(violations, /使えない操作/);
  assert.match(validate(null).join('\n'), /scenes/);
});

test('スキルの名前と使いどきが正しく、禁止語が入っていない', async () => {
  const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /^---\nname: make-video\ndescription: [^\n]+と言われたとき、または \/ai-challenge-kit:make-video と入力されたときに使う。\n---\n/);
  assert.doesNotMatch(skill, /argon|codex|agy-run|gws|GScale|ジースケール/i);
});
