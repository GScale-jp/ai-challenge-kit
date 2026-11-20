import { mkdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// 使い方: node check_app.mjs <app/index.html または http(s) の URL> [スクリーンショットの保存先]
// ブラウザ（画面を出さない Chromium）でページを開き、コンソールのエラーとページの例外を調べます。
// 終了コード: 0=エラーなし、1=エラーあり、2=Playwright か Chromium が無く、画面での確認はできていません。

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    console.error('Playwright を読み込めません。画面での確認は未実施です。cd <スキルのフォルダ>/scripts && npm install && npx playwright install chromium を実行してください。');
    return null;
  }
}

async function launch(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    // macOS の実行環境がプロセス間通信を制限している場合の回避です。
    if (process.platform === 'darwin' && /MachPortRendezvousServer.*Permission denied/.test(error.message)) {
      return chromium.launch({ headless: true, args: ['--single-process'] });
    }
    throw error;
  }
}

export function toUrl(target) {
  if (/^https?:\/\//i.test(target) || /^file:\/\//i.test(target)) return target;
  return pathToFileURL(isAbsolute(target) ? target : resolve(process.cwd(), target)).href;
}

async function main() {
  const [target, screenshot] = process.argv.slice(2);
  if (!target) {
    console.error('使い方: node check_app.mjs <app/index.html または URL> [スクリーンショットの保存先]');
    return 1;
  }
  if (!/^[a-z]+:\/\//i.test(target)) {
    try { if (!statSync(target).isFile()) throw new Error(); } catch {
      console.error(`ファイルが見つかりません: ${target}`);
      return 1;
    }
  }
  const chromium = await loadChromium();
  if (!chromium) return 2;
  let browser;
  try {
    browser = await launch(chromium);
  } catch (error) {
    if (/Executable doesn't exist|playwright install/i.test(error.message)) {
      console.error('Chromium（Playwright のブラウザ）が入っていません。画面での確認は未実施です。cd <スキルのフォルダ>/scripts && npx playwright install chromium を実行してください。');
      return 2;
    }
    throw error;
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(toUrl(target), { waitUntil: 'load', timeout: 30000 });
    if (screenshot) {
      mkdirSync(dirname(resolve(screenshot)), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true, timeout: 30000 });
    }
    if (errors.length) {
      console.error('ブラウザでエラーが出ています。\n' + errors.join('\n'));
      return 1;
    }
    console.log('ページを開けました。コンソールのエラーはありません。' + (screenshot ? `画面の写真: ${screenshot}` : ''));
    return 0;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(code => { process.exitCode = code; }, error => { console.error(error.message); process.exitCode = 1; });
}
