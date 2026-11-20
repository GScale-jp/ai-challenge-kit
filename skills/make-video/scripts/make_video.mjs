import { copyFile, mkdir, mkdtemp, open, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const limitSeconds = 90;
const defaultIntro = { title: 'Antigravity で作りました', caption: '', seconds: 8 };
const actions = new Set(['click', 'fill', 'press', 'wait']);
const templateUrl = new URL('../templates/scene.html', import.meta.url).href;
const format = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 3, useGrouping: false });

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    console.error('cd skills/make-video/scripts && npm install && npx playwright install chromium を実行してください。');
    process.exitCode = 2;
    return null;
  }
}

export async function launchChromium(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    // macOS の実行環境がプロセス間通信を制限している場合にも録画できるようにします。
    if (process.platform !== 'darwin' || !/MachPortRendezvousServer.*Permission denied/.test(error.message)) {
      throw error;
    }
    return chromium.launch({ headless: true, args: ['--single-process'] });
  }
}

export function parseScenes(markdownText) {
  const heading = /^##[ \t]+自動作成用の場面データ[ \t]*\r?$/m;
  const match = heading.exec(markdownText);
  const block = match && /^\s*```json[ \t]*\r?\n([\s\S]+?)\r?\n[ \t]*```\s*$/i.exec(
    markdownText.slice(match.index + match[0].length),
  );
  if (!block) {
    throw new Error('台本の末尾に「## 自動作成用の場面データ」と json ブロックを書いてください。');
  }
  try {
    return JSON.parse(block[1]);
  } catch {
    throw new Error('場面データの JSON を読み取れません。引用符やカンマを確認してください。');
  }
}

export function totalSeconds(data) {
  return (data.intro === undefined ? defaultIntro.seconds : data.intro.seconds)
    + data.scenes.reduce((sum, scene) => sum + scene.seconds, 0);
}

function shorteningMessage(data, total) {
  let excess = total - limitSeconds;
  const changes = [];
  const scenes = [
    ...data.scenes.map(({ id, seconds }) => ({ id, seconds })),
    { id: '導入（intro）', seconds: data.intro?.seconds ?? defaultIntro.seconds },
  ];
  for (const { id, seconds } of scenes.sort((a, b) => b.seconds - a.seconds)) {
    if (excess <= 0) break;
    const reduction = Math.min(excess, Math.max(0, seconds - 1));
    if (reduction === 0) continue;
    const shorter = Math.floor((seconds - reduction) * 1000) / 1000;
    changes.push(`「${id}」を ${format.format(seconds)} 秒から ${format.format(shorter)} 秒に`);
    excess -= seconds - shorter;
  }
  const suggestion = changes.length && excess <= 0.000001
    ? `${changes.join('、')}縮めてください。`
    : '短い場面をまとめ、合計を90秒以内に縮めてください。';
  return `合計 ${format.format(total)} 秒です。90秒を超えています。${suggestion}`;
}

function checkStep(step, label, violations) {
  if (!actions.has(step?.action)) {
    violations.push(`${label}に使えない操作（action）があります。`);
    return;
  }
  if (['click', 'fill'].includes(step.action)
    && (typeof step.selector !== 'string' || !step.selector.trim())) {
    violations.push(`${label}に操作する場所（selector）を書いてください。`);
  }
  if (step.action === 'fill' && typeof step.text !== 'string') {
    violations.push(`${label}に入力する文字（text）を書いてください。`);
  }
  if (step.action === 'press' && (typeof step.key !== 'string' || !step.key.trim())) {
    violations.push(`${label}に押すキー（key）を書いてください。`);
  }
  if (step.action === 'wait' && (!Number.isFinite(step.ms) || step.ms < 0)) {
    violations.push(`${label}の待ち時間（ms）は0以上の数で書いてください。`);
  }
}

export function validate(data) {
  if (!Array.isArray(data?.scenes) || data.scenes.length === 0) {
    return ['場面データに scenes の配列を書いてください。'];
  }
  const violations = [];
  const ids = new Set();
  const intro = data.intro === undefined ? defaultIntro : data.intro;
  const allScenes = [intro, ...data.scenes];
  for (const [index, scene] of allScenes.entries()) {
    const label = index === 0 ? '導入（intro）' : `場面 ${index}`;
    if (!Number.isFinite(scene?.seconds) || scene.seconds <= 0) {
      violations.push(`${label}の秒数（seconds）は正の数で書いてください。`);
    }
    if (typeof scene?.title !== 'string' || typeof scene?.caption !== 'string') {
      violations.push(`${label}にタイトル（title）と字幕（caption）を文字で書いてください。`);
    }
    if (index === 0) continue;
    if (typeof scene?.id !== 'string' || !scene.id.trim()) {
      violations.push(`${label}に見分けるための名前（id）を書いてください。`);
    } else if (ids.has(scene.id)) {
      violations.push(`場面の id「${scene.id}」が重複しています。`);
    } else {
      ids.add(scene.id);
    }
    if (scene?.steps !== undefined) {
      if (!Array.isArray(scene.steps)) {
        violations.push(`${label}の steps は配列で書いてください。`);
      } else {
        scene.steps.forEach((step, number) => checkStep(step, `${label}の操作 ${number + 1}`, violations));
      }
    }
  }
  if (data.antigravityClip != null && (typeof data.antigravityClip !== 'string' || !data.antigravityClip.trim())) {
    violations.push('antigravityClip には録画ファイルのパスか null を書いてください。');
  }
  if (allScenes.every((scene) => Number.isFinite(scene?.seconds) && scene.seconds > 0)) {
    const total = totalSeconds(data);
    if (total > limitSeconds) violations.push(shorteningMessage(data, total));
  }
  return violations;
}

function parseArgs(args) {
  const options = {
    '--script': join('challenge', 'video_script.md'),
    '--out': join('challenge', 'demo.webm'),
    '--app': undefined,
    '--width': '1280',
    '--height': '720',
    '--check-only': false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (!Object.hasOwn(options, flag)) throw new Error(`不明な引数です: ${flag}`);
    if (flag === '--check-only') {
      options[flag] = true;
      continue;
    }
    const value = args[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} の後に値を書いてください。`);
    options[flag] = value;
    i += 1;
  }
  for (const flag of ['--width', '--height']) {
    if (!Number.isSafeInteger(Number(options[flag])) || Number(options[flag]) < 2) {
      throw new Error(`${flag} には2以上の整数を書いてください。`);
    }
  }
  return options;
}

function asUrl(input, label, allowHttp = false) {
  if (typeof input !== 'string' || !input.trim()) throw new Error(`${label}を指定してください。`);
  if (/^file:/i.test(input) || (allowHttp && /^https?:\/\//i.test(input))) {
    return new URL(input).href;
  }
  return pathToFileURL(isAbsolute(input) ? input : join(process.cwd(), input)).href;
}

async function runSteps(page, steps, deadline) {
  const frame = page.frameLocator('#app');
  for (const [index, step] of steps.entries()) {
    const timeout = Math.floor(deadline - performance.now());
    try {
      if (timeout < 1 || (step.action === 'wait' && step.ms > timeout)) {
        throw new Error('場面の秒数に収まりません。');
      }
      switch (step.action) {
        case 'click':
          await frame.locator(step.selector).click({ timeout });
          break;
        case 'fill':
          await frame.locator(step.selector).fill(step.text, { timeout });
          break;
        case 'press':
          await frame.locator(':focus, body:not(:has(:focus))').press(step.key, { timeout });
          break;
        case 'wait':
          await sleep(step.ms);
          break;
      }
    } catch (error) {
      throw new Error(`操作 ${index + 1}（${step.action}）を完了できません。操作する場所と場面の秒数を確認してください。\n${error.message}`);
    }
  }
}

async function verifyWebm(path) {
  const file = await open(path);
  try {
    const expected = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
    const actual = Buffer.alloc(expected.length);
    const { bytesRead } = await file.read(actual, 0, actual.length, 0);
    if (bytesRead < expected.length || !actual.equals(expected)) {
      throw new Error('録画したファイルを WebM 動画として読み取れません。');
    }
  } finally {
    await file.close();
  }
}

async function recordedDuration(browser, path) {
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(path).href, { waitUntil: 'domcontentloaded' });
    return await page.locator('video').evaluate((video) => new Promise((resolve, reject) => {
      function checkDuration() {
        if (Number.isFinite(video.duration)) {
          resolve(video.duration);
        } else if (video.duration === Infinity && !video.seeking) {
          video.currentTime = 1e101;
        }
      }
      setTimeout(() => resolve(null), 5000);
      video.addEventListener('loadedmetadata', checkDuration);
      video.addEventListener('durationchange', checkDuration);
      video.addEventListener('error', () => reject(new Error('録画した WebM を再生できません。')), { once: true });
      if (video.error) reject(new Error('録画した WebM を再生できません。'));
      checkDuration();
    }), undefined, { timeout: 5000 });
  } finally {
    await page.close();
  }
}

async function record(chromium, data, options) {
  const needsApp = data.scenes.some((scene) => scene.steps?.length);
  const appUrl = needsApp ? asUrl(options['--app'] ?? data.appUrl, 'アプリの URL またはファイル', true) : null;
  const clipUrl = data.antigravityClip ? asUrl(data.antigravityClip, '録画ファイル') : null;
  const viewport = { width: Number(options['--width']), height: Number(options['--height']) };
  const directory = await mkdtemp(join(tmpdir(), 'challenge-video-'));
  let browser;
  try {
    browser = await launchChromium(chromium);
    const context = await browser.newContext({ viewport, recordVideo: { dir: directory, size: viewport } });
    const recordingStart = performance.now();
    let video;
    try {
      const page = await context.newPage();
      video = page.video();
      await page.goto(templateUrl);
      const scenes = [data.intro ?? defaultIntro, ...data.scenes];
      const sceneStart = performance.now();
      // Playwright は録画を止めるとき、最後のフレームを最低1秒保持します。
      const recordingDeadline = recordingStart + (limitSeconds - 1.2) * 1000;
      let elapsed = 0;
      for (const [index, scene] of scenes.entries()) {
        const demo = Boolean(scene.steps?.length);
        const clip = index === 0 && clipUrl;
        const id = index === 0 ? '導入（intro）' : scene.id;
        console.log(`${format.format(elapsed)} 秒から: ${id}`);
        elapsed += scene.seconds;
        const deadline = Math.min(sceneStart + elapsed * 1000, recordingDeadline);

        await page.evaluate(({ title, caption, mode }) => window.showScene({ title, caption, mode }), {
          title: scene.title,
          caption: scene.caption,
          mode: clip ? 'clip' : demo ? 'demo' : 'text',
        });
        if (clip) {
          try {
            await page.evaluate(({ url, milliseconds }) => window.playClip(url, milliseconds), {
              url: clipUrl,
              milliseconds: Math.min(5000, Math.max(0, deadline - performance.now())),
            });
          } catch {
            throw new Error('導入の録画ファイルを再生できません。ファイルの場所と Chromium で再生できる形式かを確認してください。');
          }
        }
        if (demo) {
          await page.evaluate((url) => window.showApp(url), appUrl);
          await sleep(Math.min(2000, Math.max(0, deadline - performance.now()) / 3));
          await page.evaluate(() => window.compactOverlay());
          await runSteps(page, scene.steps, deadline);
        }
        await sleep(Math.max(0, deadline - performance.now()));
      }
    } finally {
      await context.close();
    }
    const elapsedSeconds = (performance.now() - recordingStart) / 1000;
    const path = await video.path();
    await browser.close();
    await verifyWebm(path);
    browser = await launchChromium(chromium);
    const duration = await recordedDuration(browser, path);
    if (duration === 0) throw new Error('録画した WebM に映像がありません。');
    if ((duration ?? elapsedSeconds) > limitSeconds) {
      throw new Error('録画が90秒を超えました。台本の場面を少し短くして、もう一度録画してください。');
    }
    await mkdir(dirname(options['--out']), { recursive: true });
    await copyFile(path, options['--out']);
    console.log(`合計 ${format.format(totalSeconds(data))} 秒（台本）: ${options['--out']}`);
    console.log(duration === null
      ? `動画の長さを取得できなかったため、録画の実測 ${format.format(elapsedSeconds)} 秒を使用しました。`
      : `動画の長さ: ${format.format(duration)} 秒`);
  } finally {
    try {
      await browser?.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const data = parseScenes(await readFile(options['--script'], 'utf8'));
  const violations = validate(data);
  if (violations.length) throw new Error(violations.join('\n'));
  if (options['--check-only']) {
    console.log(`合計 ${format.format(totalSeconds(data))} 秒です。90秒以内に収まっています。`);
    return;
  }
  const chromium = await loadChromium();
  if (chromium) await record(chromium, data, options);
}

const entry = process.argv[1] && await realpath(process.argv[1]).catch(() => null);
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
