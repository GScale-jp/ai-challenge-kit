// E2E 用: 応募フォームのダミー（実物と同じ構造）を 127.0.0.1 だけで配信する。
// 使い方: node serve_dummy.mjs <ポート番号を書き出すファイル> <フォームへの操作の記録ファイル>
// ダミーのフォームは、送信や同意のチェックが押されると /__event?<種類> を呼ぶ。その記録を残す。
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [portFile, eventLog] = process.argv.slice(2);
const root = dirname(fileURLToPath(import.meta.url));
const form = join(root, '..', 'skills', 'entry-submit', 'tests', 'fixtures', 'dummy_form_md.html');
writeFileSync(eventLog, '');
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/__event') {
    appendFileSync(eventLog, url.search.slice(1) + '\n');
    response.writeHead(204).end();
  } else if (url.pathname === '/dummy_form_md.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(readFileSync(form));
  } else {
    response.writeHead(404).end();
  }
});
server.listen(0, '127.0.0.1', () => writeFileSync(portFile, String(server.address().port)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
