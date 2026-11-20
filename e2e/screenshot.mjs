// 使い方: node screenshot.mjs <ファイルまたは URL> <PNG の保存先> [待つミリ秒]
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, loadChromium } from './playwright_path.mjs';

const [target, output, wait = '1500'] = process.argv.slice(2);
const browser = await launch(await loadChromium());
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const url = /^[a-z]+:\/\//i.test(target) ? target : pathToFileURL(resolve(target)).href;
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(Number(wait));
  await page.screenshot({ path: output, timeout: 30000 });
} finally {
  await browser.close();
}
