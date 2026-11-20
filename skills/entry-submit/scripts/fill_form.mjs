import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const defaultMap = JSON.parse(readFileSync(new URL('./field_map.json', import.meta.url), 'utf8'));
const defaultUrl = 'https://googlejp25.withgoogle.com/awards-form';
const requiredKeys = ['name', 'email', 'title', 'summary', 'category', 'youtube_url'];
const handoff = '同意3点のチェックと送信ボタンは押していません。同意事項を読んでチェックし、内容を確かめて、自分で送信ボタンを押してください。締切後は直せません。';
const actionTimeout = 2000;

export async function loadEntry(path) {
  const contents = await readFile(path, 'utf8');
  const entry = JSON.parse(contents.replace(/^\uFEFF/, ''));
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error('応募内容のファイルには、項目名と値を記入してください。');
  }
  return entry;
}

export function missingRequired(entry) {
  return requiredKeys.filter(key => typeof entry[key] !== 'string' || !entry[key].trim());
}

function normalize(text) {
  return String(text ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

export function isNeverClick(text) {
  const normalized = normalize(text);
  return defaultMap.neverClick.some(word => normalized.includes(normalize(word)));
}

function labelPattern(label) {
  const escaped = label.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp('^\\s*' + escaped + '\\s*(?:[＊*]|[（(]\\s*(?:必須|任意)\\s*[）)])?\\s*$', 'i');
}

function namedLocators(scope, label, roles) {
  const name = labelPattern(label);
  return [scope.getByLabel(name), ...roles.map(role => scope.getByRole(role, { name }))];
}

async function isSafeControl(handle, expected, blockedWords) {
  return handle.evaluate((element, { expected, blockedWords }) => {
    const containsBlockedWord = text => {
      const normalized = (text ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
      return blockedWords.some(word => normalized.includes(word));
    };
    const isSubmit = node => node.getAttribute('type')?.toLowerCase() === 'submit' ||
      (node.tagName === 'BUTTON' && node.type === 'submit') ||
      (node.tagName === 'INPUT' && node.type === 'image');
    const hasBlockedLabel = (node, ownText = node.textContent) => {
      const labels = Array.from(node.labels ?? [], label => label.textContent);
      for (const attribute of ['aria-labelledby', 'aria-describedby']) {
        const ids = node.getAttribute(attribute)?.split(/\s+/) ?? [];
        for (const id of ids) labels.push(node.getRootNode().getElementById(id)?.textContent);
      }
      const buttonText = node.matches('input[type="button"], input[type="submit"]') ? node.value : '';
      return [
        ownText, node.id, node.getAttribute('name'), node.getAttribute('title'),
        node.getAttribute('aria-label'), node.getAttribute('placeholder'), buttonText, ...labels
      ].some(containsBlockedWord);
    };

    // 複数の入力欄を含む親要素では、別の欄の文章まで判定に含めません。
    const controlSelector = 'input:not([type="hidden"]), textarea, select, button, ' +
      '[role="button"], [role="tab"], [role="radio"], [role="checkbox"], [contenteditable="true"]';
    const interactiveSelector = 'label, button, a[href], [role="button"], [role="tab"], ' +
      '[role="radio"], [role="checkbox"], [type="submit"]';
    if (isSubmit(element) || hasBlockedLabel(element)) return false;
    let inField = true;
    for (let node = element; node && !node.matches('form, body, html, [role="tabpanel"]');
        node = node.parentElement) {
      const otherControl = Array.from(node.querySelectorAll(controlSelector)).some(control => control !== element);
      inField = inField && !otherControl;
      if (node !== element) {
        if (node.matches(interactiveSelector) && (isSubmit(node) || hasBlockedLabel(node))) return false;
        const headings = node.querySelectorAll(':scope > legend, :scope > h2, :scope > h3, :scope > h4');
        const context = inField ? node.textContent : Array.from(headings, heading => heading.textContent).join(' ');
        if (hasBlockedLabel(node, context)) return false;
      }
      if (!inField) continue;
      for (const direction of ['previousSibling', 'nextSibling']) {
        let neighbor = node[direction];
        while (neighbor && (neighbor.nodeType === Node.COMMENT_NODE ||
            (neighbor.nodeType === Node.TEXT_NODE && !neighbor.textContent.trim()))) {
          neighbor = neighbor[direction];
        }
        if (neighbor?.nodeType === Node.TEXT_NODE && containsBlockedWord(neighbor.textContent)) return false;
        if (neighbor?.nodeType === Node.ELEMENT_NODE &&
            neighbor.matches('span, small, p, div, label') &&
            (!neighbor.matches('label') || neighbor.control === element) &&
            !neighbor.matches(controlSelector) && !neighbor.querySelector(controlSelector) &&
            hasBlockedLabel(neighbor)) return false;
      }
    }

    switch (expected) {
      case 'tab':
        return element.matches('[role="tab"], [role="button"], button, input[type="button"]');
      case 'text':
        return element.tagName === 'INPUT' && ['text', 'email', 'url', 'search', 'tel'].includes(element.type);
      case 'textarea':
        return element.tagName === 'TEXTAREA' || (element.isContentEditable && element.matches('[role="textbox"]'));
      case 'select':
        return element.tagName === 'SELECT';
      case 'option':
        return element.tagName === 'OPTION';
      case 'radio':
        return element.matches('input[type="radio"], [role="radio"]');
      case 'checkbox':
        return element.matches('input[type="checkbox"], [role="checkbox"]');
      default:
        return false;
    }
  }, { expected, blockedWords });
}

async function findControl(scope, labels, roles, expected, blockedWords) {
  for (const label of labels) {
    if (blockedWords.some(word => normalize(label).includes(word))) continue;
    for (const locator of namedLocators(scope, label, roles)) {
      const matches = [];
      for (const handle of await locator.elementHandles()) {
        if (await handle.isVisible() && await handle.isEnabled() &&
            await isSafeControl(handle, expected, blockedWords)) {
          matches.push(handle);
        }
      }
      if (matches.length === 1) return matches[0];
    }
  }
  return null;
}

async function choiceScope(scope, labels) {
  for (const label of labels) {
    for (const locator of namedLocators(scope, label, ['radiogroup', 'group'])) {
      const groups = locator.and(scope.locator('fieldset, [role="group"], [role="radiogroup"]'));
      if (await groups.count() === 1 && await groups.isVisible()) return groups;
    }
  }
  return scope;
}

// 実物のフォームは Material Web の部品（md-outlined-text-field・md-radio・md-checkbox）で、
// 入力欄の中身は Shadow DOM の中にあります。画面の文字ではなく、部品の name 属性で探します。
// 見つからない（null）ときは、画面のラベルで探す従来の方法に切り替えます。
async function fillByControlName(scope, field, value, blockedWords) {
  const name = field.controlName;
  if (!name || blockedWords.some(word => normalize(name).includes(word))) return null;
  const options = { timeout: actionTimeout };
  const hosts = scope.locator(`[name="${name}"]`);
  const count = await hosts.count();
  if (count === 0) return null;

  if (field.type === 'radio' || field.type === 'checkbox-group') {
    if (!field.values) return null;
    const known = Object.values(field.values).map(attr => `[name="${name}"][value="${attr}"]`).join(', ');
    if (await scope.locator(known).count() === 0) return null;
    const choices = field.type === 'radio' ? [value] : value;
    if (!Array.isArray(choices)) return false;
    let allFound = true;
    for (const choice of choices) {
      const attr = Object.hasOwn(field.values, choice) ? field.values[choice] : null;
      if (attr === null || blockedWords.some(word => normalize(attr).includes(word))) { allFound = false; continue; }
      const host = scope.locator(`[name="${name}"][value="${attr}"]`);
      if (await host.count() !== 1) { allFound = false; continue; }
      const checked = () => host.evaluate(element => Boolean(element.checked));
      if (!await checked()) await host.click(options);
      if (!await checked()) allFound = false;
    }
    return allFound;
  }

  if (typeof value !== 'string' || count !== 1) return false;
  const tag = await hosts.evaluate(element => element.tagName);
  const control = tag === 'INPUT' || tag === 'TEXTAREA' ? hosts : hosts.locator('input, textarea');
  if (await control.count() !== 1) return false;
  const handle = await control.elementHandle();
  try {
    if (!await handle.isVisible() || !await handle.isEnabled() ||
        !await isSafeControl(handle, tag === 'TEXTAREA' || await handle.evaluate(element => element.tagName === 'TEXTAREA') ? 'textarea' : 'text', blockedWords)) return false;
    await handle.fill(value, options);
    return true;
  } finally {
    await handle.dispose();
  }
}

async function fillField(scope, field, value, blockedWords) {
  const byName = await fillByControlName(scope, field, value, blockedWords);
  if (byName !== null) return byName;
  const options = { timeout: actionTimeout };
  if (field.type === 'radio' || field.type === 'checkbox-group') {
    const role = field.type === 'radio' ? 'radio' : 'checkbox';
    const choices = field.type === 'radio' ? [value] : value;
    if (!Array.isArray(choices)) return false;
    const group = await choiceScope(scope, field.labels);
    let allFound = true;
    for (const choice of choices) {
      const labels = Object.hasOwn(field.options, choice) ? field.options[choice] : [];
      const handle = await findControl(group, labels, [role], role, blockedWords);
      if (!handle) {
        allFound = false;
      } else if (role === 'radio') {
        await handle.click(options);
        if (!(await handle.isChecked())) allFound = false;
      } else {
        await handle.check(options);
      }
    }
    return allFound;
  }

  if (typeof value !== 'string') return false;
  const role = field.type === 'select' ? 'combobox' : 'textbox';
  const handle = await findControl(scope, field.labels, [role], field.type, blockedWords);
  if (!handle) return false;
  if (field.type === 'select') {
    const labels = field.options && Object.hasOwn(field.options, value) ? field.options[value] : [value];
    for (const label of labels) {
      if (blockedWords.some(word => normalize(label).includes(word))) continue;
      const option = await handle.evaluateHandle((select, label) =>
        Array.from(select.options).find(option => option.label === label) ?? null, label);
      try {
        const target = option.asElement();
        if (!target || !await isSafeControl(target, 'option', blockedWords)) continue;
        await handle.selectOption(target, options);
        return true;
      } finally {
        await option.dispose();
      }
    }
    return false;
  }
  await handle.fill(value, options);
  return true;
}

async function switchTab(page, tab, blockedWords) {
  const control = await findControl(page, [tab], ['tab', 'button'], 'tab', blockedWords);
  if (!control) return false;
  try {
    if (await control.getAttribute('aria-selected') !== 'true') {
      await control.click({ timeout: actionTimeout });
    }
    return true;
  } catch {
    return false;
  }
}

function isEmpty(value) {
  return value == null || (typeof value === 'string' && !value.trim()) ||
    (Array.isArray(value) && value.every(item => typeof item === 'string' && !item.trim()));
}

export async function fillForm(page, entry, map = defaultMap) {
  const missing = missingRequired(entry);
  if (missing.length) throw new Error('必須項目が空です。' + missing.join('、'));

  const fields = Object.entries(map.fields);
  const tabs = [...new Set(fields.map(([, field]) => field.tab))];
  const blockedWords = [...defaultMap.neverClick, ...map.neverClick].map(normalize).filter(Boolean);
  const tabLocators = tabs.flatMap(tab => namedLocators(page, tab, ['tab', 'button']));
  const tabCounts = await Promise.all(tabLocators.map(locator => locator.count()));
  const hasTabs = tabCounts.some(count => count > 0);
  const results = {};

  for (const tab of tabs) {
    const canFill = !hasTabs || await switchTab(page, tab, blockedWords);
    const panel = page.getByRole('tabpanel', { name: labelPattern(tab) });
    const scope = await panel.count() === 1 ? panel : page;
    for (const [key, field] of fields.filter(([, field]) => field.tab === tab)) {
      const value = entry[key];
      if (isEmpty(value)) {
        results[key] = 'skipped-empty';
        continue;
      }
      let filled = false;
      if (canFill) {
        try {
          filled = await fillField(scope, field, value, blockedWords);
        } catch {
          // ブラウザで操作できない項目は、画面を残して手入力へ切り替えます。
        }
      }
      results[key] = filled ? 'filled' : 'not-found';
    }
  }
  return results;
}

function printResults(results, entry, fields) {
  const groups = [
    ['filled', '入力できた項目'],
    ['not-found', '見つからなかった項目（手で入力してください）'],
    ['skipped-empty', '空だったので飛ばした項目']
  ];
  for (const [status, heading] of groups) {
    const keys = Object.keys(results).filter(key => results[key] === status);
    console.log(heading);
    if (!keys.length) console.log('（なし）');
    for (const key of keys) {
      console.log(fields[key].labels[0]);
      if (status === 'not-found') {
        const value = Array.isArray(entry[key]) ? entry[key].join('\n') : entry[key];
        console.log('--------------------\n' + value + '\n--------------------');
      }
    }
  }
}

async function saveReport(page, results, path) {
  const inputs = await page.locator('input, textarea, select').evaluateAll(elements =>
    elements.map(element => ({
      id: element.id,
      name: element.name,
      type: element.type,
      value: element.type === 'password' ? '' : element.value,
      checked: element.checked ?? false
    })));
  await writeFile(path, JSON.stringify({ fields: results, inputs }, null, 2) + '\n', { mode: 0o600 });
}

async function waitForEnter(page) {
  console.log('作業が終わったら、このターミナルで Enter を押すとブラウザが閉じます。');
  if (page.isClosed()) return;
  const input = createInterface({ input: process.stdin });
  try {
    await new Promise(resolve => {
      page.once('close', resolve);
      input.once('line', resolve);
    });
  } finally {
    input.close();
  }
}

async function main() {
  let browser;
  let page;
  let keepOpen = false;
  try {
    let chromium;
    try {
      ({ chromium } = await import('playwright'));
    } catch {
      console.error('Playwright を読み込めません。cd skills/entry-submit/scripts && npm install && npx playwright install chromium を実行してください。');
      return 2;
    }

    const { values } = parseArgs({ options: {
      data: { type: 'string', default: 'challenge/entry_form.json' },
      url: { type: 'string', default: defaultUrl },
      headless: { type: 'boolean', default: false },
      'no-keep-open': { type: 'boolean', default: false },
      report: { type: 'string' },
      screenshot: { type: 'string' }
    } });
    const entry = await loadEntry(values.data);
    const missing = missingRequired(entry);
    if (missing.length) {
      console.error('必須項目が空です。応募内容のファイルを直してください。');
      for (const key of missing) console.error('- ' + defaultMap.fields[key].labels[0]);
      return 1;
    }
    if (!entry.youtube_url.includes('youtu')) {
      console.warn('動画の URL に「youtu」がありません。YouTube の限定公開 URL か確かめてください。');
    }

    // macOS の権限が制限された環境でも、ローカルのテスト用フォームを開けるようにします。
    const localMacTest = process.platform === 'darwin' && values.headless && values.url.startsWith('file:');
    browser = await chromium.launch({
      headless: values.headless,
      args: localMacTest ? ['--single-process'] : []
    });
    page = await browser.newPage();
    await page.goto(values.url, { waitUntil: 'domcontentloaded' });
    const results = await fillForm(page, entry);
    printResults(results, entry, defaultMap.fields);
    keepOpen = !values.headless && !values['no-keep-open'];
    if (values.report) await saveReport(page, results, values.report);
    // 入力後の画面の写真（記録用）。同意と送信には触れません。
    if (values.screenshot) await page.screenshot({ path: values.screenshot, fullPage: true });
    return 0;
  } catch (error) {
    console.error('応募フォームの入力を続けられませんでした。' + error.message);
    return 1;
  } finally {
    console.log(handoff);
    try {
      if (keepOpen && !page.isClosed()) await waitForEnter(page);
    } finally {
      await browser?.close();
    }
  }
}

const invokedFile = process.argv[1];
if (invokedFile && existsSync(invokedFile) && import.meta.url === pathToFileURL(realpathSync(invokedFile)).href) {
  process.exitCode = await main();
}
