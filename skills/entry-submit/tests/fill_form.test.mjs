import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '../scripts/node_modules/playwright/index.mjs';
import { fillForm, isNeverClick, loadEntry, missingRequired } from '../scripts/fill_form.mjs';

const fixtureDirectory = new URL('./fixtures/', import.meta.url);
const fixture = name => new URL(name, fixtureDirectory);
const entryFile = fileURLToPath(fixture('entry_form.json'));
const missingFile = fileURLToPath(fixture('entry_form_missing.json'));
const script = fileURLToPath(new URL('../scripts/fill_form.mjs', import.meta.url));
const fieldMapPath = new URL('../scripts/field_map.json', import.meta.url);
const map = JSON.parse(await readFile(fieldMapPath, 'utf8'));
const entry = await loadEntry(entryFile);

async function openForm(t, filename = 'dummy_form.html') {
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === 'darwin' ? ['--single-process'] : []
  });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(fixture(filename).href);
  return page;
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'entry-submit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function runCli(...args) {
  return runScript(script, ...args);
}

function runScript(filename, ...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [filename, ...args], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function statuses(status) {
  return Object.fromEntries(Object.keys(map.fields).map(key => [key, status]));
}

test('2つのタブの全項目を入力し、同意も送信も操作しない', async t => {
  const page = await openForm(t);
  const results = await fillForm(page, entry, map);
  assert.deepEqual(results, statuses('filled'));
  for (const [key, value] of Object.entries(entry)) {
    if (key !== 'category' && key !== 'ai_tools' && map.fields[key]) {
      assert.equal(await page.locator('#' + key).inputValue(), value);
    }
  }
  assert.deepEqual(await page.locator('[name="category"]:checked').evaluateAll(inputs =>
    inputs.map(input => input.value)), ['life']);
  assert.deepEqual(await page.locator('[name="ai_tools"]:checked').evaluateAll(inputs =>
    inputs.map(input => input.value)), ['gemini', 'studio', 'antigravity']);
  assert.equal(await page.getByRole('tab', { name: '作品情報' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate(() => window.__submitted), false);
  assert.equal(await page.evaluate(() => window.__consentTouched), false);
  assert.deepEqual(await page.locator('#agreements input').evaluateAll(inputs =>
    inputs.map(input => input.checked)), [false, false, false]);
});

test('実物と同じ構造（Shadow DOM・タブなし・Material 部品）のフォームに入力し、同意も送信も操作しない', async t => {
  const page = await openForm(t, 'dummy_form_md.html');
  const results = await fillForm(page, entry, map);
  assert.deepEqual(results, statuses('filled'));
  const value = name => page.locator(`md-outlined-text-field[name="${name}"] input, md-outlined-text-field[name="${name}"] textarea`).inputValue();
  assert.equal(await value('fullname'), entry.name);
  assert.equal(await value('email'), entry.email);
  assert.equal(await value('overviewidea'), entry.summary);
  assert.equal(await value('demovideourl'), entry.youtube_url);
  assert.equal(await value('insightspurpose'), entry.story_background);
  assert.equal(await value('creativityhow'), entry.story_ai_usage);
  assert.equal(await value('impactscalability'), entry.story_impact);
  assert.equal(await value('urlofthedemo'), entry.product_url);
  assert.deepEqual(await page.locator('md-radio[checked]').evaluateAll(items => items.map(item => item.getAttribute('value'))),
    ['暮らしと家族の部門']);
  assert.deepEqual(await page.locator('md-checkbox[name="tool"][checked]').evaluateAll(items => items.map(item => item.getAttribute('value'))),
    ['gemini', 'google-ai-studio', 'google-antigravity']);
  assert.equal(await page.locator('md-checkbox[checked][name="termsandprivacy"], md-checkbox[checked][name="application-guidelines"], md-checkbox[checked][name="older-than-18"]').count(), 0);
  assert.equal(await page.evaluate(() => window.__submitted), false);
  assert.equal(await page.evaluate(() => window.__consentTouched), false);
});

test('CLI は動画 URL に警告しても入力を続け、入力値と選択状態を報告する', async t => {
  const directory = await temporaryDirectory(t);
  const report = join(directory, 'report.json');
  const videoUrl = 'https://example.invalid/video';
  const data = join(directory, 'entry_form.json');
  await writeFile(data, '\uFEFF' + JSON.stringify({ ...entry, youtube_url: videoUrl }), 'utf8');
  const result = await runCli('--data', data, '--url', fixture('dummy_form.html').href,
    '--headless', '--no-keep-open', '--report', report);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /同意3点のチェックと送信ボタンは押していません/);
  assert.match(result.stderr, /動画の URL に「youtu」がありません/);
  const saved = JSON.parse(await readFile(report, 'utf8'));
  assert.deepEqual(saved.fields, statuses('filled'));
  assert.equal(saved.inputs.find(input => input.id === 'name').value, entry.name);
  assert.equal(saved.inputs.find(input => input.id === 'summary').value, entry.summary);
  assert.equal(saved.inputs.find(input => input.id === 'youtube_url').value, videoUrl);
  assert.deepEqual(saved.inputs.filter(input => input.checked).map(input => input.value),
    ['life', 'gemini', 'studio', 'antigravity']);
  assert.deepEqual(saved.inputs.filter(input => input.id.startsWith('consent-')).map(input => input.checked),
    [false, false, false]);
});

test('ラベルがなければ項目ごとに値をそのまま表示して正常終了する', async t => {
  const report = join(await temporaryDirectory(t), 'report.json');
  const result = await runCli('--data', entryFile, '--url', fixture('dummy_form_unlabeled.html').href,
    '--headless', '--no-keep-open', '--report', report);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /見つからなかった項目/);
  for (const [key, value] of Object.entries(entry)) {
    if (!map.fields[key]) continue; // pr は実物のフォームに欄がない
    const copyValue = Array.isArray(value) ? value.join('\n') : value;
    assert.ok(result.stdout.includes(map.fields[key].labels[0] + '\n--------------------\n' +
      copyValue + '\n--------------------'), key);
  }
  const saved = JSON.parse(await readFile(report, 'utf8'));
  assert.deepEqual(saved.fields, statuses('not-found'));
  assert.equal(saved.inputs.find(input => input.id === 'name').value, '');
  assert.ok(saved.inputs.every(input => !input.checked));
});

test('必須項目を一覧に出し、URL を開いたり入力したりせずに終了する', async t => {
  const report = join(await temporaryDirectory(t), 'report.json');
  const invalid = await loadEntry(missingFile);
  const keys = ['name', 'email', 'title', 'summary', 'category', 'youtube_url'];
  assert.deepEqual(missingRequired(invalid), keys);
  const result = await runCli('--data', missingFile, '--url', '開けないURL',
    '--headless', '--no-keep-open', '--report', report);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /必須項目が空です/);
  for (const key of keys) assert.ok(result.stderr.includes('- ' + map.fields[key].labels[0]));
  assert.doesNotMatch(result.stderr, /page\.goto/);
  await assert.rejects(readFile(report), { code: 'ENOENT' });
  await assert.rejects(fillForm({}, invalid, map), /必須項目が空です/);
});

test('空の任意項目は既存値を保ち、選択メニューは表示名で選べる', async t => {
  const page = await openForm(t);
  await page.evaluate(() => {
    document.getElementById('pen_name').value = '入力済みの値';
    const categories = document.getElementById('categories');
    categories.outerHTML = '<label>応募カテゴリー<select id="category">' +
      '<option value="work">はたらく・まなぶ部門</option>' +
      '<option value="life">暮らしと家族の部門</option></select></label>';
  });
  const withSelect = structuredClone(map);
  withSelect.fields.category.type = 'select';
  const results = await fillForm(page, { ...entry, pen_name: ' ', ai_tools: [] }, withSelect);
  assert.deepEqual(results, { ...statuses('filled'), pen_name: 'skipped-empty', ai_tools: 'skipped-empty' });
  assert.equal(await page.locator('#pen_name').inputValue(), '入力済みの値');
  assert.equal(await page.locator('#category').inputValue(), 'life');
});

test('チェック欄を囲む要素の外側に同意文言があっても操作しない', async t => {
  const page = await openForm(t);
  await page.evaluate(() => {
    document.querySelector('[name="ai_tools"][value="studio"]').closest('label').remove();
    const checkbox = document.getElementById('consent-privacy');
    const wrapper = document.createElement('div');
    const nearbyText = document.createElement('span');
    checkbox.id = 'studio-alias';
    checkbox.setAttribute('aria-label', 'Google AI Studio');
    nearbyText.textContent = '個人情報の取り扱いについて';
    wrapper.append(checkbox);
    document.getElementById('tools').append(wrapper, nearbyText);
  });
  const results = await fillForm(page, entry, map);
  assert.equal(results.ai_tools, 'not-found');
  assert.equal(await page.locator('#studio-alias').isChecked(), false);
  assert.equal(await page.locator('[name="ai_tools"][value="gemini"]').isChecked(), true);
  assert.equal(await page.evaluate(() => window.__consentTouched), false);
});

test('タブと同じ名前でも送信ボタンや送信の説明があるボタンは操作しない', async t => {
  const page = await openForm(t);
  await page.evaluate(() => {
    const realTab = document.getElementById('work-tab');
    realTab.hidden = true;
    const list = realTab.parentElement;
    list.insertAdjacentHTML('beforeend',
      '<button aria-label="作品情報" id="native-trap">作品情報</button>' +
      '<span role="button" aria-label="作品情報" aria-describedby="button-purpose" id="role-action">作品情報</span>' +
      '<span id="button-purpose" hidden>応募を送信</span>' +
      '<input type="button" aria-label="作品情報" value="Submit" id="button-input">');
    for (const candidate of list.querySelectorAll('#native-trap, #role-action, #button-input')) {
      candidate.addEventListener('click', () => { window.__submitted = true; });
    }
  });
  const results = await fillForm(page, entry, map);
  assert.equal(results.name, 'filled');
  assert.equal(results.title, 'not-found');
  assert.equal(await page.evaluate(() => window.__submitted), false);
});

test('選択肢に表示されない属性でも、同意を示していれば選択しない', async t => {
  const page = await openForm(t);
  await page.evaluate(() => {
    document.getElementById('categories').outerHTML = '<label>応募カテゴリー<select id="category">' +
      '<option value="work">はたらく・まなぶ部門</option>' +
      '<option value="life" title="応募規約への同意">暮らしと家族の部門</option></select></label>';
    document.getElementById('category').addEventListener('change', () => { window.__consentTouched = true; });
  });
  const withSelect = structuredClone(map);
  withSelect.fields.category.type = 'select';
  const results = await fillForm(page, entry, withSelect);
  assert.equal(results.category, 'not-found');
  assert.equal(await page.locator('#category').inputValue(), 'work');
  assert.equal(await page.evaluate(() => window.__consentTouched), false);
});

test('Playwright が見つからなければ準備手順を表示し、終了コード2で終わる', async t => {
  const directory = await temporaryDirectory(t);
  const isolatedScript = join(directory, 'fill_form.mjs');
  await copyFile(script, isolatedScript);
  await copyFile(fieldMapPath, join(directory, 'field_map.json'));
  const result = await runScript(isolatedScript);
  assert.equal(result.code, 2, result.stderr);
  assert.match(result.stderr, /cd skills\/entry-submit\/scripts && npm install && npx playwright install chromium/);
});

test('禁止文言は大文字、小文字、全角と空白の違いを含めて判定する', () => {
  for (const text of ['送信する', 'Submit entry', 'ＳＵＢＭＩＴ', '同意する', 'プライバシー ポリシー',
    '募集要項', '応募規約', '私は １８ 歳以上です', '個人情報の取扱い']) {
    assert.equal(isNeverClick(text), true, text);
  }
  for (const text of ['応募者情報', '作品情報', 'アイデアのタイトル', 'Google AI Studio', 'その他', '']) {
    assert.equal(isNeverClick(text), false, text);
  }
});

test('SKILL.md は指定の front matter と操作の決まりを含む', async () => {
  const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /^---\r?\nname: entry-submit\r?\ndescription: [^\r\n]+と言われたとき、または \/ai-challenge-kit:entry-submit と入力されたときに使う。\r?\n---/);
  assert.doesNotMatch(skill, /argon|codex|agy-run|gws|GScale|ジースケール/i);
  assert.match(skill, /同意/);
  assert.match(skill, /送信ボタンは押さない/);
});
