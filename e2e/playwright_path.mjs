// E2E 用: リポジトリ内の Playwright（skills/make-video/scripts に npm ci したもの）を読み込む。
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function loadChromium() {
  const entry = join(root, 'skills', 'make-video', 'scripts', 'node_modules', 'playwright', 'index.mjs');
  if (!existsSync(entry)) {
    throw new Error('Playwright がありません。cd skills/make-video/scripts && npm ci && npx playwright install chromium を実行してください。');
  }
  return (await import(pathToFileURL(entry).href)).chromium;
}

export async function launch(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (process.platform === 'darwin' && /MachPortRendezvousServer.*Permission denied/.test(error.message)) {
      return chromium.launch({ headless: true, args: ['--single-process'] });
    }
    throw error;
  }
}
