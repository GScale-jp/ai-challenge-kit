import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildPlan, parseDeploymentId, parseListedDeployment } from '../scripts/deploy_gas.mjs';

const skillDir = fileURLToPath(new URL('../', import.meta.url));
const script = join(skillDir, 'scripts', 'deploy_gas.mjs');

function fixture(t, { manifest = true, existingProject = false } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'challenge-deploy-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const bin = join(cwd, 'bin');
  const src = join(cwd, 'gas-app');
  const dest = join(cwd, '.gas-deploy');
  mkdirSync(bin);
  mkdirSync(src);
  if (manifest) {
    writeFileSync(join(src, 'appsscript.json'), JSON.stringify({
      timeZone: 'Asia/Tokyo',
      webapp: { executeAs: 'USER_DEPLOYING', access: 'MYSELF' },
    }));
  }
  if (existingProject) {
    mkdirSync(dest);
    writeFileSync(join(dest, '.clasp.json'), '{"scriptId":"existing-script-id"}\n');
  }
  return { cwd, bin, src, dest };
}

function run({ cwd, bin }, args, path = bin) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PATH: path },
  });
  assert.ifError(result.error);
  return result;
}

test('clasp が PATH に無くても新規の予定を順に表示し、作業フォルダを作らない', t => {
  const work = fixture(t);
  const result = run(work, ['--title', '試作アプリ', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  const commands = result.stdout.trim().split(/\r?\n/);
  assert.equal(commands.length, 4);
  assert.match(commands[0], /^\[dry-run\] clasp -u default create-script --type standalone --title 試作アプリ$/);
  assert.match(commands[1], /^\[dry-run\] clasp -u default push -f$/);
  assert.match(commands[2], /^\[dry-run\] clasp -u default list-deployments$/);
  assert.match(commands[3], /^\[dry-run\] clasp -u default create-deployment -d /);
  assert.equal(existsSync(work.dest), false);
});

test('更新の予定では新規作成せず、一覧の番号付き ID を -i で指定する', t => {
  const work = fixture(t, { existingProject: true });
  writeFileSync(join(work.dest, '作業メモ.txt'), 'そのまま');
  const result = run(work, ['--update', '--user', 'practice', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /create-script/);
  assert.match(result.stdout, /^\[dry-run\] clasp -u practice create-deployment -i /m);
  assert.match(result.stdout, /既存のデプロイ ID を一覧から探して指定/);
  assert.deepEqual(readdirSync(work.dest).sort(), ['.clasp.json', '作業メモ.txt']);
  assert.equal(readFileSync(join(work.dest, '.clasp.json'), 'utf8'), '{"scriptId":"existing-script-id"}\n');
  assert.equal(readFileSync(join(work.dest, '作業メモ.txt'), 'utf8'), 'そのまま');
});

test('clasp 3.x の公開結果と一覧から ID を読み取る', () => {
  assert.equal(parseDeploymentId('Deploying project...\nDeployed AKfycb-abc_123 @4\n'), 'AKfycb-abc_123');
  assert.equal(parseDeploymentId('Deployed AKfycb-abc_123 @2\r\n'), 'AKfycb-abc_123');
  assert.equal(parseDeploymentId('Never Deployed AKfycb-abc_123'), null);
  assert.equal(parseListedDeployment([
    'Found 3 deployments.', '- AKfycb-testing @HEAD', '- AKfycb-live_1 @3 - Web アプリ', '- AKfycb-old @1',
  ].join('\r\n')), 'AKfycb-live_1');
  assert.equal(parseListedDeployment('- AKfycb-testing @HEAD\n'), null);
  assert.equal(parseListedDeployment('- AKfycb-incomplete @3oops\n'), null);
  assert.equal(parseListedDeployment('No deployments.'), null);
});

test('マニフェストが無ければ、公開の予定を表示せず終了コード1を返す', t => {
  const work = fixture(t, { manifest: false });
  const result = run(work, ['--src', work.src, '--title', '試作', '--dry-run']);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /appsscript\.json が見つかりません/);
  assert.equal(result.stdout, '');
  assert.equal(existsSync(work.dest), false);
});

test('更新に必要な設定と新規作成に必要なタイトルを調べる', t => {
  const work = fixture(t);
  assert.throws(() => buildPlan({ update: true }), /\.clasp\.json/);
  assert.throws(() => buildPlan(), /--title/);
  assert.throws(() => buildPlan({ title: '試作', access: 'INVALID' }), /--access/);
  const result = run(work, ['--update', '--dry-run']);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /\.clasp\.json/);
  assert.equal(existsSync(work.dest), false);
});

test('clasp がない状態で公開しようとすると終了コード2とインストール案内を返す', t => {
  const work = fixture(t);
  const args = ['--title', '試作'];
  const initial = run(work, args);
  assert.equal(initial.status, 2, initial.stderr);
  assert.match(initial.stderr, /npm i -g @google\/clasp を実行してください/);
  assert.equal(existsSync(work.dest), false);

  mkdirSync(work.dest);
  const previous = join(work.dest, '前の作業メモ.txt');
  writeFileSync(previous, '元の内容');
  const rerun = run(work, args);
  assert.equal(rerun.status, 2, rerun.stderr);
  assert.deepEqual(readdirSync(work.dest), ['前の作業メモ.txt']);
  assert.equal(readFileSync(previous, 'utf8'), '元の内容');
});

test('元のフォルダやワークスペースを作業用コピーの置き先にできない', t => {
  const work = fixture(t);
  for (const path of ['gas-app', '.', 'gas-app/child']) {
    const result = run(work, ['--title', '試作', '--dest', path]);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /公開専用の作業フォルダ/);
    assert.equal(existsSync(join(work.src, 'appsscript.json')), true);
  }
});

function installFakeClasp(bin) {
  const program = `
    const fs = require('node:fs');
    const assert = require('node:assert/strict');
    const path = require('node:path');
    const args = process.argv.slice(2);
    assert.equal(fs.realpathSync(process.env.clasp_config_project), fs.realpathSync(process.cwd()));
    fs.appendFileSync(path.join('..', 'calls.jsonl'), JSON.stringify(args) + '\\n');
    if (args[2] === 'create-script') {
      fs.writeFileSync('.clasp.json', '{"scriptId":"new-script-id"}\\n');
      fs.writeFileSync('appsscript.json', '{}');
      fs.writeFileSync('Code.js', 'clasp が取得した初期ファイル');
    }
    if (args[2] === 'push') {
      assert.equal(fs.existsSync('Code.js'), false);
      assert.ok(fs.existsSync('Code.gs'));
      assert.ok(fs.existsSync('index.html'));
      const manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
      assert.equal(manifest.timeZone, 'Asia/Tokyo');
      assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
    }
    if (args[2] === 'list-deployments') {
      console.log('- test-id @HEAD');
      if (fs.existsSync(path.join('..', 'already-published'))) console.log('- live-id @1 - 公開済み');
    }
    if (args[2] === 'create-deployment') console.log('Deployed live-id @2');
  `;
  if (process.platform === 'win32') {
    const entry = join(bin, 'node_modules', '@google', 'clasp', 'build', 'src');
    mkdirSync(entry, { recursive: true });
    writeFileSync(join(bin, 'clasp.cmd'), '@echo off\r\nexit /b 1\r\n');
    writeFileSync(join(entry, 'index.js'), program);
  } else {
    writeFileSync(join(bin, 'clasp'), `#!/usr/bin/env node\n${program}`, { mode: 0o755 });
  }
}

test('公開の代役で初回の設定の復元と、同じ ID での更新を確認する', t => {
  const work = fixture(t);
  installFakeClasp(work.bin);
  const path = [work.bin, dirname(process.execPath)].join(delimiter);
  writeFileSync(join(work.src, 'Code.gs'), 'function doGet() {}');
  writeFileSync(join(work.src, 'index.html'), '<h1>試作</h1>');
  const created = run(work, ['--title', '試作 アプリ', '--access', 'ANYONE'], path);
  assert.equal(created.status, 0, created.stderr);
  assert.match(created.stdout, /https:\/\/script\.google\.com\/macros\/s\/live-id\/exec/);
  assert.match(created.stdout, /https:\/\/script\.google\.com\/d\/new-script-id\/edit/);
  assert.equal(JSON.parse(readFileSync(join(work.dest, 'appsscript.json'), 'utf8')).webapp.access, 'ANYONE');
  assert.equal(JSON.parse(readFileSync(join(work.src, 'appsscript.json'), 'utf8')).webapp.access, 'MYSELF');

  writeFileSync(join(work.cwd, 'already-published'), '');
  writeFileSync(join(work.dest, '古いファイル.html'), '前の版');
  writeFileSync(join(work.src, '.clasp.json'), '{"scriptId":"source-id"}');
  const updated = run(work, ['--update', '--user', 'practice'], path);
  assert.equal(updated.status, 0, updated.stderr);
  assert.equal(updated.stdout, created.stdout);
  assert.equal(readFileSync(join(work.dest, '.clasp.json'), 'utf8'), '{"scriptId":"new-script-id"}\n');
  assert.equal(JSON.parse(readFileSync(join(work.dest, 'appsscript.json'), 'utf8')).webapp.access, 'MYSELF');
  assert.equal(existsSync(join(work.dest, '古いファイル.html')), false);

  const calls = readFileSync(join(work.cwd, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(calls.map(args => args[2]), [
    'create-script', 'push', 'list-deployments', 'create-deployment', 'push', 'list-deployments', 'create-deployment',
  ]);
  assert.equal(calls[0].at(-1), '試作 アプリ');
  assert.equal(calls[3].includes('-i'), false);
  assert.deepEqual(calls.at(-1).slice(0, 5), ['-u', 'practice', 'create-deployment', '-i', 'live-id']);
});

test('スキルの名前と説明がそろい、Markdown に社内用語がない', () => {
  const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skill);
  assert.ok(frontMatter);
  assert.equal(/^name: (\S+)$/m.exec(frontMatter[1])?.[1], basename(skillDir));
  assert.match(frontMatter[1], /^description: .+と言われたとき、または \/ai-challenge-kit:deploy と入力されたときに使う。$/m);
  for (const file of readdirSync(skillDir, { recursive: true }).filter(name => name.endsWith('.md'))) {
    assert.doesNotMatch(readFileSync(join(skillDir, file), 'utf8'), /argon|codex|agy-run|gws|GScale|ジースケール/i, file);
  }
});

test('スクリプトに .sh が含まれていない', () => {
  const files = readdirSync(join(skillDir, 'scripts'), { recursive: true });
  assert.equal(files.some(name => /\.sh$/i.test(name)), false);
});
