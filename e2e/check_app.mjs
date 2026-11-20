import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [file, screenshot, toolDir] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const home = homedir();

function packageNear(dir) {
  try { return require.resolve('playwright', dir ? { paths: [dir] } : {}); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
}

function directories(dir) {
  try { return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(dir, entry.name)); }
  catch (error) {
    if (!['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) throw error;
    return [];
  }
}

function resolvePlaywright() {
  const local = packageNear() || packageNear(toolDir);
  if (local) return local;
  const globalRoot = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', timeout: 10000 }).stdout?.trim();
  const baseDirs = [home, join(home, 'Documents'), join(home, 'work'), join(home, 'src'),
    join(home, '.npm', '_npx'), dirname(resolve(dirname(fileURLToPath(import.meta.url)), '..'))];
  const candidates = ['/opt/homebrew/lib', '/usr/local/lib', globalRoot && dirname(globalRoot),
    ...baseDirs, ...baseDirs.flatMap(directories)].filter(Boolean);
  for (const dir of new Set(candidates)) {
    const candidate = packageNear(dir);
    if (candidate) return candidate;
  }
}

function run(program, args, cwd) {
  const result = spawnSync(program, args, { cwd, stdio: 'inherit', timeout: 240000 });
  if (result.error || result.status !== 0) throw new Error(`${program} に失敗しました（${result.error?.message || result.status}）。`);
}

async function check() {
  if (!file || !screenshot || !toolDir || !statSync(file).isFile()) throw new Error('app/index.html を確認できません。');
  let entry = resolvePlaywright();
  if (!entry) {
    mkdirSync(toolDir, { recursive: true });
    run('npm', ['i', '--no-save', '--prefix', toolDir, 'playwright'], toolDir);
    run('npx', ['--no-install', 'playwright', 'install', 'chromium'], toolDir);
    entry = packageNear(toolDir);
    if (!entry) throw new Error('Playwright を読み込めません。');
  }
  const { chromium } = require(entry);
  const launch = () => chromium.launch({ headless: true, timeout: 30000 });
  let browser;
  try { browser = await launch(); }
  catch (error) {
    if (!/Executable doesn't exist/.test(error.message)) throw error;
    const manifest = require.resolve('playwright/package.json', { paths: [dirname(entry)] });
    run(process.execPath, [join(dirname(manifest), 'cli.js'), 'install', 'chromium']);
    browser = await launch();
  }
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load', timeout: 30000 });
    await page.screenshot({ path: screenshot, fullPage: true, timeout: 30000 });
    if (errors.length) throw new Error(`ブラウザーでエラーが発生しました。\n${errors.join('\n')}`);
    console.log('Chromium でページの表示とスクリーンショットを確認しました。');
  } finally {
    await browser.close();
  }
}

try { await check(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
