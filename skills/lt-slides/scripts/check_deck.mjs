import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const defaultDeckPath = join('challenge', 'lt', 'deck.json');
const officialForm = 'https://googlejp25.withgoogle.com/awards-form';

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const length = (value) => [...value].length;

export function checkDeck(deck) {
  if (!deck || typeof deck !== 'object' || Array.isArray(deck)) {
    return ['deck.json にスライドのデータを書いてください。'];
  }
  const violations = [];
  if (!hasText(deck.title)) violations.push('発表の題（title）を書いてください。');
  for (const field of ['speaker', 'event']) {
    if (deck[field] !== undefined && typeof deck[field] !== 'string') {
      violations.push(`${field} は文字で書いてください。`);
    }
  }
  if (typeof deck.applyUrl !== 'string' || !deck.applyUrl.startsWith(officialForm)) {
    violations.push(`応募フォームの URL（applyUrl）は ${officialForm} から始めてください。`);
  }
  if (!hasText(deck.demoUrl)) violations.push('デモの URL（demoUrl）を書いてください。');
  if (!Array.isArray(deck.slides)) {
    violations.push('スライド（slides）は配列で書いてください。');
    return violations;
  }
  if (deck.slides.length < 5 || deck.slides.length > 10) {
    violations.push('スライドは5〜10枚にしてください。');
  }

  let total = 0;
  for (const [index, slide] of deck.slides.entries()) {
    const label = `${index + 1}枚目`;
    if (!hasText(slide?.id)) violations.push(`${label}の id（見分けるための名前）を書いてください。`);
    const heading = typeof slide?.heading === 'string' ? slide.heading : '';
    if (length(heading.trim()) < 8 || length(heading) > 40 || heading.trim().endsWith('。')) {
      violations.push(`${label}の見出し（heading）は8〜40字で、末尾に「。」を付けずに書いてください。`);
    }

    const body = slide?.body ?? [];
    if (!Array.isArray(body) || body.some((line) => typeof line !== 'string')) {
      violations.push(`${label}の本文（body）は文字の配列で書いてください。`);
    } else {
      const characters = length(heading) + body.reduce((sum, line) => sum + length(line), 0);
      if (characters > 120) violations.push(`${label}が ${characters} 字あります。見出しと本文を合わせて120字以内にしてください。`);
    }
    if (!hasText(slide?.script)) violations.push(`${label}の話す台本（script）を書いてください。`);
    if (!Number.isFinite(slide?.seconds) || slide.seconds <= 0) {
      violations.push(`${label}の秒数（seconds）は正の数で書いてください。`);
    } else {
      total += slide.seconds;
    }
  }
  if (total > 300) violations.push(`合計 ${total} 秒です。300秒（5分）以内にしてください。`);

  const last = deck.slides.at(-1);
  if (last) {
    const lines = [last.heading, ...(Array.isArray(last.body) ? last.body : [])];
    if (['applyUrl', 'demoUrl'].some((field) => !hasText(deck[field])
      || !lines.some((line) => typeof line === 'string' && line.includes(deck[field])))) {
      violations.push('最後のスライドに応募フォームの URL（applyUrl）とデモの URL（demoUrl）を両方書いてください。');
    }
  }
  return violations;
}

// 描画した後の画面で、見出しや本文が枠からはみ出していないかを調べる（scrollWidth > clientWidth など）。
// page は section が並ぶ印刷用 HTML を開いた Playwright のページ。
export async function findOverflows(page) {
  return page.evaluate(() => {
    const problems = [];
    document.querySelectorAll('section').forEach((section, index) => {
      const label = `${index + 1}枚目`;
      const heading = section.querySelector('h2');
      if (heading && heading.scrollWidth > heading.clientWidth + 1) {
        problems.push(`${label}の見出しが右端ではみ出しています。短くするか、言い換えてください。`);
      }
      if (heading) {
        const fontSize = parseFloat(getComputedStyle(heading).fontSize);
        if (heading.clientHeight > fontSize * 1.25 * 2 + 2) {
          problems.push(`${label}の見出しが3行以上に折り返しています。短くしてください。`);
        }
      }
      section.querySelectorAll('li, p').forEach((element) => {
        if (element.scrollWidth > element.clientWidth + 1) problems.push(`${label}の文がはみ出しています。`);
      });
      if (section.scrollHeight > section.clientHeight + 1) {
        problems.push(`${label}の中身が枠の下にはみ出しています。文を減らしてください。`);
      }
    });
    return problems;
  });
}

// 見出しのはみ出しは、実際に描画しないと分からない。Playwright が無いときは null を返す（未実施）。
export async function checkLayout(deck) {
  let chromium;
  try {
    chromium = (await import('playwright')).chromium;
  } catch {
    return null;
  }
  const { printHtml } = await import('./build_deck.mjs');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (process.platform === 'darwin' && /MachPortRendezvousServer.*Permission denied/.test(error.message)) {
      browser = await chromium.launch({ headless: true, args: ['--single-process'] });
    } else if (/Executable doesn't exist|playwright install/i.test(error.message)) {
      return null;
    } else {
      throw error;
    }
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
    await page.setContent(printHtml(deck));
    return await findOverflows(page);
  } finally {
    await browser.close();
  }
}

export async function readDeck(path) {
  const source = await readFile(path, 'utf8');
  try {
    return JSON.parse(source);
  } catch {
    throw new Error('deck.json を読み取れません。引用符やカンマを確認してください。');
  }
}

export function parseArgs(args, defaults) {
  const options = { ...defaults };
  for (let index = 0; index < args.length; index += 2) {
    const [flag, value] = args.slice(index, index + 2);
    if (!Object.hasOwn(options, flag)) throw new Error(`不明な引数です: ${flag}`);
    if (!value || value.startsWith('--')) throw new Error(`${flag} の後に値を書いてください。`);
    options[flag] = value;
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2), { '--deck': defaultDeckPath });
  const deck = await readDeck(options['--deck']);
  const violations = checkDeck(deck);
  if (violations.length) throw new Error(violations.join('\n'));
  const overflows = await checkLayout(deck);
  if (overflows === null) {
    console.log('スライドは5分以内です。文字数、見出し、最後のリンクも確認できました。見出しのはみ出しの確認は未実施です（Playwright が入っていないため）。');
  } else if (overflows.length) {
    throw new Error(overflows.join('\n'));
  } else {
    console.log('スライドは5分以内です。文字数、見出し、最後のリンクも確認できました。見出しのはみ出しもありません。');
  }
}

const entry = process.argv[1] && await realpath(process.argv[1]).catch(() => null);
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
