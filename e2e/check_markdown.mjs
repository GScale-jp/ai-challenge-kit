import { readFileSync } from 'node:fs';

const [file, template] = process.argv.slice(2);
const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
function headings(text) {
  // コードフェンス内の見出しは数えない。
  let fence;
  return text.split(/\r?\n/).flatMap((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      return [];
    }
    const match = !fence && line.match(/^##\s+(.+?)\s*$/);
    return match ? [match[1].replace(/\s+#+$/, '').trim()] : [];
  });
}

try {
  const markdown = readFileSync(file, 'utf8');
  if (!markdown.trim() || !japanese.test(markdown)) throw new Error(`日本語の本文がありません: ${file}`);
  if (template) {
    const expected = headings(readFileSync(template, 'utf8'));
    if (expected.length === 0) throw new Error(`テンプレートに必須見出しがありません: ${template}`);
    const actual = new Set(headings(markdown));
    const missing = expected.filter((heading) => !actual.has(heading));
    if (missing.length) throw new Error(`必須見出しがありません: ${missing.join('、')}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
