// E2E の生成物を検査する。使い方: node verify.mjs <種類> <引数...>
//   video-script <video_script.md>            台本に場面データがあり、合計が90秒以内か
//   video <demo.webm> <場面の画像の保存先>      webm があり、長さが90秒以内か（再生して確かめる）
//   entry-json <entry_form.json>              キーがそろい、必須の値が入っているか
//   entry-submit <report.json> <操作の記録>    全項目が入力済みで、同意と送信が押されていないか
//   deploy-dry-run <出力ファイル>              clasp のコマンドを表示しただけか
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, loadChromium } from './playwright_path.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [kind, ...args] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function videoScript(file) {
  const { parseScenes, totalSeconds, validate } = await import(
    pathToFileURL(join(root, 'skills', 'make-video', 'scripts', 'make_video.mjs')).href);
  const data = parseScenes(readFileSync(file, 'utf8'));
  const problems = validate(data);
  if (problems.length) fail('場面データに問題があります。\n' + problems.join('\n'));
  console.log('場面データ: 合計 ' + totalSeconds(data) + ' 秒（90秒以内）');
}

async function video(file, image) {
  if (!existsSync(file) || statSync(file).size < 5000) fail('動画ファイルがないか小さすぎます: ' + file);
  const browser = await launch(await loadChromium());
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(pathToFileURL(file).href);
    const info = await page.evaluate(async () => {
      const video = document.querySelector('video');
      if (video.readyState < 1) await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('動画を再生できません'));
        setTimeout(() => reject(new Error('動画の読み込みが終わりません')), 20000);
      });
      // 録画した WebM は長さが未確定（Infinity）のことがあるので、最後までシークして確かめる。
      if (!Number.isFinite(video.duration)) {
        video.currentTime = 1e9;
        await new Promise(resolve => { video.ontimeupdate = resolve; setTimeout(resolve, 20000); });
      }
      const duration = video.duration;
      video.currentTime = Math.min(5, duration / 2);
      await new Promise(resolve => { video.onseeked = resolve; setTimeout(resolve, 5000); });
      return { duration, width: video.videoWidth, height: video.videoHeight };
    });
    await page.screenshot({ path: image });
    if (!(info.duration > 5)) fail('動画が短すぎます（' + info.duration + ' 秒）');
    if (info.duration > 90.5) fail('動画が90秒を超えています（' + info.duration + ' 秒）');
    console.log('動画: ' + info.duration.toFixed(1) + ' 秒、' + info.width + 'x' + info.height);
  } finally {
    await browser.close();
  }
}

function entryJson(file) {
  const entry = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const keys = ['name', 'email', 'pen_name', 'title', 'summary', 'category', 'youtube_url', 'pr', 'product_url',
    'story_background', 'story_ai_usage', 'story_impact', 'ai_tools'];
  const missing = keys.filter(key => !Object.hasOwn(entry, key));
  if (missing.length) fail('キーがありません: ' + missing.join('、'));
  const empty = ['name', 'email', 'title', 'summary', 'category', 'story_background', 'story_ai_usage', 'story_impact']
    .filter(key => typeof entry[key] !== 'string' || !entry[key].trim());
  if (empty.length) fail('値が空です: ' + empty.join('、'));
  if (!['暮らしと家族', 'はたらく・まなぶ', 'まちと地球の未来'].includes(entry.category)) {
    fail('category の値が正しくありません: ' + entry.category);
  }
  if (!Array.isArray(entry.ai_tools)) fail('ai_tools は配列にしてください');
  const tools = ['Gemini', 'Gemini Notebook', 'Google AI Studio', 'Google Antigravity', 'その他'];
  const wrong = entry.ai_tools.filter(tool => !tools.includes(tool));
  if (wrong.length) fail('ai_tools に使えない値があります: ' + wrong.join('、'));
  console.log('entry_form.json: 13個のキーがそろっています（概要 ' + entry.summary.length + ' 字）');
}

function entrySubmit(reportFile, eventLog) {
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  const notFilled = Object.entries(report.fields)
    .filter(([, status]) => status !== 'filled' && status !== 'skipped-empty');
  if (notFilled.length) fail('入力できなかった項目があります: ' + notFilled.map(([key]) => key).join('、'));
  const filled = Object.values(report.fields).filter(status => status === 'filled').length;
  if (filled < 8) fail('入力できた項目が少なすぎます（' + filled + '）');
  const events = readFileSync(eventLog, 'utf8').trim();
  if (events) fail('同意のチェックまたは送信が押されました: ' + events.replace(/\n/g, ', '));
  console.log('entry-submit: ' + filled + ' 項目を入力。同意と送信は押されていません。');
}

function deployDryRun(file) {
  const text = readFileSync(file, 'utf8');
  if (!/\[dry-run\][^\n]*clasp[^\n]*push/.test(text)) fail('dry-run の出力に clasp push の予定が見つかりません。');
  console.log('deploy: dry-run で clasp のコマンドを表示しました。');
}

try {
  if (kind === 'video-script') await videoScript(args[0]);
  else if (kind === 'video') await video(args[0], args[1]);
  else if (kind === 'entry-json') entryJson(args[0]);
  else if (kind === 'entry-submit') entrySubmit(args[0], args[1]);
  else if (kind === 'deploy-dry-run') deployDryRun(args[0]);
  else fail('使い方: node verify.mjs <video-script|video|entry-json|entry-submit|deploy-dry-run> ...');
} catch (error) {
  fail(error.message);
}
