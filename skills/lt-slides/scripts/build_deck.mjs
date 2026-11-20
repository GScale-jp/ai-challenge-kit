import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkDeck, defaultDeckPath, findOverflows, parseArgs, readDeck } from './check_deck.mjs';

const reveal = 'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0';

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    console.error('cd skills/lt-slides/scripts && npm install && npx playwright install chromium を実行してください。');
    process.exitCode = 2;
    return null;
  }
}

async function launchChromium(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    // macOS の実行環境がプロセス間通信を制限している場合にも印刷できるようにします。
    if (process.platform !== 'darwin' || !/MachPortRendezvousServer.*Permission denied/.test(error.message)) {
      throw error;
    }
    return chromium.launch({ headless: true, args: ['--single-process'] });
  }
}

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text) => text.replace(/[&<>"']/g, (character) => entities[character]);

function renderText(text, deck) {
  const links = [...new Set([deck.applyUrl, deck.demoUrl])].filter((url) => /^https?:\/\//i.test(url));
  links.sort((left, right) => right.length - left.length);
  const pattern = links.map((url) => url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!pattern) return escapeHtml(text);
  const regex = new RegExp(pattern, 'g');
  let html = '';
  let cursor = 0;
  for (const match of text.matchAll(regex)) {
    const link = escapeHtml(match[0]);
    html += escapeHtml(text.slice(cursor, match.index));
    html += `<a href="${link}">${link}</a>`;
    cursor = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(cursor));
}

// 見出しが1行に収まる文字の大きさを選ぶ（全角は1字分、半角の英数字は約0.55字分で数える）。
// 収まらないほど長いときは下限の大きさで2行に折り返す。右端ではみ出さないようにするための決まり。
export function headingSize(heading, availablePx, maxPx, minPx = 34) {
  const em = [...heading].reduce((sum, character) => sum + (/[\x20-\x7e]/.test(character) ? 0.55 : 1), 0);
  return Math.max(minPx, Math.min(maxPx, Math.floor(availablePx / (em || 1))));
}

function slideContent(deck, slide, index, layout) {
  const attribution = index === 0
    ? [deck.title, deck.speaker, deck.event].filter(Boolean)
      .map((text) => `<p>${escapeHtml(text)}</p>`).join('')
    : '';
  const body = slide.body ?? [];
  const lines = body.map((line) => `<li>${renderText(line, deck)}</li>`).join('');
  const list = lines ? `<ul${body.length > 4 ? ' class="compact"' : ''}>${lines}</ul>` : '';
  const size = headingSize(slide.heading, layout.available, layout.max);
  return `<h2 style="font-size:${size}px">${renderText(slide.heading, deck)}</h2>${attribution ? `<header>${attribution}</header>` : ''}${list}`;
}

const compactListStyle = `
    ul.compact { margin-left: 0; padding-left: 0; }
    ul.compact li { display: inline; }
    ul.compact li + li::before { content: " ・ "; }
`;

function presentationHtml(deck) {
  const sections = deck.slides.map((slide, index) => `
    <section id="${escapeHtml(slide.id)}">
      ${slideContent(deck, slide, index, { available: 850, max: 52 })}
      <aside class="notes">${escapeHtml(slide.script)}</aside>
    </section>`).join('\n');
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(deck.title)}</title>
  <link rel="stylesheet" href="${reveal}/dist/reset.css">
  <link rel="stylesheet" href="${reveal}/dist/reveal.css">
  <link rel="stylesheet" href="${reveal}/dist/theme/white.css">
  <style>
    .reveal { font-family: system-ui, "Yu Gothic", "Hiragino Sans", sans-serif; }
    .reveal .slides { text-align: left; }
    .reveal .slides section { box-sizing: border-box; padding-inline: 55px; }
    .reveal h2 { font: 750 52px/1.25 system-ui, sans-serif; letter-spacing: 0; color: #132c3e; text-transform: none; overflow-wrap: anywhere; word-break: auto-phrase; text-wrap: balance; }
    .reveal header { margin: 24px 0; color: #32566a; font-size: 24px; }
    .reveal header p { margin: 5px 0; }
    .reveal ul { display: block; margin-left: 1.25em; font-size: 35px; }
    .reveal li { margin-block: 0.35em; overflow-wrap: anywhere; }
    .reveal a { color: #006b76; overflow-wrap: anywhere; font-size: 0.75em; }
    ${compactListStyle}
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">${sections}
    </div>
  </div>
  <script src="${reveal}/dist/reveal.js"></script>
  <script src="${reveal}/plugin/notes/notes.js"></script>
  <script>Reveal.initialize({ hash: true, width: 960, height: 540, plugins: [RevealNotes] });</script>
</body>
</html>
`;
}

export function printHtml(deck) {
  const sections = deck.slides.map((slide, index) => `<section>${slideContent(deck, slide, index, { available: 1010, max: 50 })}</section>`).join('\n');
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(deck.title)}</title>
  <style>
    @page { size: 12in 6.75in; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #132c3e; font-family: system-ui, "Yu Gothic", "Hiragino Sans", sans-serif; }
    section {
      width: 12in; height: 6.75in; padding: 54px 68px;
      display: flex; flex-direction: column; justify-content: center;
      break-inside: avoid; overflow: hidden;
    }
    section + section { break-before: page; }
    h2 { margin: 0 0 18px; font-size: 50px; line-height: 1.25; overflow-wrap: anywhere; word-break: auto-phrase; text-wrap: balance; }
    header { margin-bottom: 16px; color: #32566a; font-size: 23px; }
    header p { margin: 3px 0; }
    ul { margin: 0; padding-left: 1.25em; font-size: 33px; line-height: 1.4; }
    li { margin-bottom: 8px; overflow-wrap: anywhere; }
    a { color: #006b76; font-size: 0.78em; }
    ${compactListStyle}
  </style>
</head>
<body>
${sections}
</body>
</html>
`;
}

function speakerScript(deck) {
  const markdownText = (text) => text.replace(/[&<>]/g, (character) => entities[character]);
  const slides = deck.slides.map((slide) => `## ${markdownText(slide.heading)}（${slide.seconds}秒）\n\n${markdownText(slide.script)}\n`);
  return `# ${markdownText(deck.title)}\n\n${slides.join('\n')}`;
}

async function buildPdf(chromium, deck) {
  const browser = await launchChromium(chromium);
  try {
    const page = await browser.newPage();
    await page.setContent(printHtml(deck));
    const overflows = await findOverflows(page);
    if (overflows.length) throw new Error(overflows.join('\n'));
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    // 日時だけを同じバイト数で固定して、PDF 内の位置情報を保ちます。
    const dates = /(\/(?:CreationDate|ModDate) \(D:)\d{14}[+-]\d{2}'\d{2}'(?=\))/g;
    const stablePdf = pdf.toString('latin1').replace(dates, (_, prefix) => `${prefix}20000101000000+00'00'`);
    return Buffer.from(stablePdf, 'latin1');
  } finally {
    await browser.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2), {
    '--deck': defaultDeckPath,
    '--outdir': join('challenge', 'lt'),
  });
  const deck = await readDeck(options['--deck']);
  const violations = checkDeck(deck);
  if (violations.length) throw new Error(violations.join('\n'));

  const chromium = await loadChromium();
  if (!chromium) return;
  const pdf = await buildPdf(chromium, deck);
  const outdir = options['--outdir'];
  await mkdir(outdir, { recursive: true });
  await Promise.all([
    writeFile(join(outdir, 'lt.html'), presentationHtml(deck)),
    writeFile(join(outdir, 'lt.pdf'), pdf),
    writeFile(join(outdir, 'script.md'), speakerScript(deck)),
  ]);
  console.log(`${outdir} に lt.html、lt.pdf、script.md を作りました。`);
}

const entry = process.argv[1] && await realpath(process.argv[1]).catch(() => null);
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
