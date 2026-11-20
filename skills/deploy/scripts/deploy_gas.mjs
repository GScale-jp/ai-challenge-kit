import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, cp, lstat, mkdir, readFile, readdir, realpath, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const manifestName = 'appsscript.json';
const projectName = '.clasp.json';
const lockName = '.deploy.lock';
const accessOptions = ['MYSELF', 'DOMAIN', 'ANYONE'];
const description = 'Google AI Challenge Web アプリ';

export function buildPlan({
  src = 'gas-app', dest = '.gas-deploy', title, access, update = false,
  user = 'default', hasClaspJson = false,
} = {}) {
  if (update && !hasClaspJson) {
    throw new Error('--update には以前の作業フォルダの .clasp.json が必要です。--dest を確認してください。');
  }
  if (!hasClaspJson && !title?.trim()) {
    throw new Error('初めて公開するときは --title でプロジェクト名を指定してください。');
  }
  if (access !== undefined && !accessOptions.includes(access)) {
    throw new Error('--access には MYSELF、DOMAIN、ANYONE のどれかを指定してください。');
  }

  const account = ['-u', user];
  return {
    src,
    dest,
    access,
    create: hasClaspJson ? null : [...account, 'create-script', '--type', 'standalone', '--title', title],
    push: [...account, 'push', '-f'],
    list: [...account, 'list-deployments'],
    deploy: [...account, 'create-deployment'],
  };
}

export function parseDeploymentId(text) {
  return /^[ \t]*Deployed[ \t]+([\w-]+)(?=[ \t\r\n]|$)/m.exec(text)?.[1] ?? null;
}

export function parseListedDeployment(text) {
  return /^[ \t]*-[ \t]+([\w-]+)[ \t]+@\d+(?=[ \t\r\n]|$)/m.exec(text)?.[1] ?? null;
}

function deployArgs(plan, deploymentId) {
  const existing = deploymentId ? ['-i', deploymentId] : [];
  return [...plan.deploy, ...existing, '-d', description];
}

async function statIfPresent(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

async function resolveLocation(path) {
  if (await statIfPresent(path)) return realpath(path);
  return join(await resolveLocation(dirname(path)), basename(path));
}

function contains(parent, child) {
  const difference = relative(parent, child);
  return difference !== '..' && !difference.startsWith(`..${sep}`) && !isAbsolute(difference);
}

async function readObject(path, name) {
  const text = await readFile(path, 'utf8');
  let data;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(`${name} の書き方を確認してください。JSON として読み取れません。`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${name} は { } で設定を書く JSON ファイルにしてください。`);
  }
  return { data, text };
}

async function copySource(plan, manifest) {
  const staged = await readdir(plan.dest);
  if (staged.some(name => name.toLowerCase() === '.git')) {
    throw new Error('--dest にはリポジトリとは別の、公開専用の作業フォルダを指定してください。');
  }
  const reserved = [projectName, lockName, '.clasprc.json', manifestName];
  const source = (await readdir(plan.src)).filter(name => !reserved.includes(name.toLowerCase()));
  for (const name of staged) {
    if (![projectName, lockName].includes(name.toLowerCase())) {
      await rm(join(plan.dest, name), { recursive: true, force: true });
    }
  }
  for (const name of source) {
    await cp(join(plan.src, name), join(plan.dest, name), { recursive: true });
  }
  await writeFile(join(plan.dest, manifestName), manifest);
}

async function claspExecutable() {
  const windows = process.platform === 'win32';
  const executable = windows ? 'clasp.cmd' : 'clasp';
  const pathEntries = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const directory = resolve(entry.replace(/^"(.*)"$/, '$1'));
    const candidate = join(directory, executable);
    try {
      if (!(await stat(candidate)).isFile()) continue;
      await access(candidate, constants.X_OK);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code)) continue;
      throw error;
    }
    if (!windows) return { file: candidate, prefix: [] };

    // npm の .cmd はシェルが必要なので、同じ clasp の本体を Node で起動します。
    const globalEntry = join(directory, 'node_modules', '@google', 'clasp', 'build', 'src', 'index.js');
    const localEntry = join(directory, '..', '@google', 'clasp', 'build', 'src', 'index.js');
    for (const claspEntry of [globalEntry, localEntry]) {
      if ((await statIfPresent(claspEntry))?.isFile()) {
        return { file: process.execPath, prefix: [claspEntry] };
      }
    }
  }
  throw Object.assign(new Error(`${executable} が見つかりません。`), { code: 'ENOENT' });
}

function runClasp({ file, prefix }, args, cwd) {
  return new Promise((accept, reject) => {
    const child = spawn(file, [...prefix, ...args], {
      cwd,
      // 上位フォルダの .clasp.json があっても、作業フォルダだけを使います。
      env: { ...process.env, clasp_config_project: cwd },
      stdio: ['ignore', 'pipe', 'inherit'],
      shell: false,
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; });
    child.once('error', error => {
      if (error.code === 'ENOENT') error.claspMissing = true;
      reject(error);
    });
    child.once('close', (code, signal) => {
      if (code === 0) {
        accept(output);
      } else {
        if (output.trim()) console.error(output.trimEnd());
        reject(new Error(`clasp ${args[2]} に失敗しました（${signal ?? `終了コード ${code}`}）。`));
      }
    });
  });
}

async function readProject(dest) {
  const path = join(dest, projectName);
  if (!(await statIfPresent(path))?.isFile()) {
    throw new Error('作業フォルダに有効な .clasp.json がありません。');
  }
  const { data } = await readObject(path, projectName);
  if (typeof data.scriptId !== 'string' || !/^[\w-]+$/.test(data.scriptId)) {
    throw new Error('.clasp.json の scriptId（Apps Script のプロジェクト ID）を確認してください。');
  }
  if (resolve(dest, data.srcDir || data.rootDir || '.') !== dest) {
    throw new Error('.clasp.json が別のフォルダを指しています。以前にこのスクリプトで使った作業フォルダを指定してください。');
  }
  return data.scriptId;
}

function printDryRun(plan) {
  const existingId = plan.create ? null : '<既存のデプロイID>';
  const commands = [plan.create, plan.push, plan.list, deployArgs(plan, existingId)];
  for (const args of commands.filter(Boolean)) {
    const display = args.map(arg => /\s|["\\]/.test(arg) ? JSON.stringify(arg) : arg);
    console.log(`[dry-run] clasp ${display.join(' ')}`);
  }
  if (existingId) {
    console.log('既存のデプロイ ID を一覧から探して指定します（-i）。番号付きのデプロイが無ければ新しい URL を発行します。');
  }
}

async function deploy(plan, manifest) {
  let executable;
  try {
    executable = await claspExecutable();
  } catch (error) {
    if (error.code === 'ENOENT') error.claspMissing = true;
    throw error;
  }
  await mkdir(plan.dest, { recursive: true });
  const lock = join(plan.dest, lockName);
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error('同じ作業フォルダで別の公開処理が実行中です。終わってからもう一度実行してください。');
  }
  try {
    if (plan.create && await statIfPresent(join(plan.dest, projectName))) {
      throw new Error('作業フォルダに .clasp.json が作られました。公開先を確認してから、もう一度実行してください。');
    }
    let scriptId = plan.create ? null : await readProject(plan.dest);
    await copySource(plan, manifest);
    if (plan.create) {
      await runClasp(executable, plan.create, plan.dest);
      scriptId = await readProject(plan.dest);
      // create-script が取得した初期ファイルを取り除き、元のアプリの内容に戻します。
      await copySource(plan, manifest);
    }
    await runClasp(executable, plan.push, plan.dest);
    const listed = await runClasp(executable, plan.list, plan.dest);
    const existingId = parseListedDeployment(listed);
    const output = await runClasp(executable, deployArgs(plan, existingId), plan.dest);
    const deploymentId = parseDeploymentId(output);
    if (!deploymentId) {
      throw new Error('公開版の ID を読み取れません。Apps Script の「デプロイを管理」で URL を確認してください。');
    }
    console.log(`アプリの URL: https://script.google.com/macros/s/${deploymentId}/exec`);
    console.log(`編集画面の URL: https://script.google.com/d/${scriptId}/edit`);
  } finally {
    await rmdir(lock);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      src: { type: 'string', default: 'gas-app' },
      dest: { type: 'string', default: '.gas-deploy' },
      title: { type: 'string' },
      access: { type: 'string' },
      user: { type: 'string', default: 'default' },
      update: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    },
  });
  const manifestPath = join(resolve(values.src), manifestName);
  if (!(await statIfPresent(manifestPath))?.isFile()) {
    throw new Error(`--src に appsscript.json が見つかりません（${manifestPath}）。`);
  }
  const src = await realpath(values.src);
  const dest = await resolveLocation(resolve(values.dest));
  const cwd = await realpath(process.cwd());
  if (contains(dest, cwd) || contains(dest, src) || contains(src, dest)) {
    throw new Error('--dest には元のファイルやワークスペースとは別の、公開専用の作業フォルダを指定してください。');
  }
  const hasClaspJson = Boolean(await statIfPresent(join(dest, projectName)));
  const plan = buildPlan({ ...values, src, dest, hasClaspJson });
  const { data, text } = await readObject(manifestPath, manifestName);
  let manifest = text;
  if (plan.access !== undefined) {
    data.webapp = { ...data.webapp, access: plan.access };
    manifest = `${JSON.stringify(data, null, 2)}\n`;
  }
  if (values['dry-run']) {
    printDryRun(plan);
    return;
  }
  await deploy(plan, manifest);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    if (error.claspMissing) {
      console.error('clasp が見つかりません。npm i -g @google/clasp を実行してください。');
      process.exitCode = 2;
    } else {
      console.error(`エラー: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
