const http = require('node:http');
const { buildError, buildSuccess, normalizeEmail, isGmail } = require('../gas/src/core');

const passphrase = 'テストの"合言葉"\\台風\n備え';
const step = '画面の"適用"を押す\\確認\n手順を確認 ✅';
const badMessage = '合言葉が違います。"入力"を確認してください。\n会場で確かめてください ✅';

async function startMockServer() {
  const requests = [];
  const assignments = new Map();
  const results = new Map();
  const server = http.createServer(async (req, res) => {
    const request = { method: req.method, path: req.url, contentType: req.headers['content-type'] };
    requests.push(request);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let processed = false;
    const reply = (json) => {
      if (!processed) return send(json);
      const t = String(results.size + 1);
      results.set(t, json);
      res.writeHead(302, { Location: `/echo?t=${t}` }).end();
    };
    const send = (json) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      // 一部の日本語と絵文字をエスケープして、デコードも検査する。
      res.end(JSON.stringify(json, null, 2).replace(/[会場✅]/g,
        (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
        .replace(/🌧/g, '\\ud83c\\udf27'));
    };

    if (req.url === '/disconnect') {
      req.socket.destroy();
      return;
    }
    if (req.url === '/malformed') {
      res.end('<html>応答エラー</html>');
      return;
    }
    // 本物の GAS と同じ動き: POST を処理して結果を転送先に置き、302 で返す。
    // 転送先は GET で取りに行く。転送先に POST し直すと 405 になる。
    if (req.url.startsWith('/echo')) {
      if (req.method !== 'GET') {
        res.writeHead(405).end('Method Not Allowed');
        return;
      }
      const t = new URL(req.url, 'http://x').searchParams.get('t');
      if (!results.has(t)) { res.writeHead(404).end(); return; }
      send(results.get(t));
      return;
    }
    if (req.method !== 'POST' || !/^text\/plain;\s*charset=utf-8$/i.test(request.contentType || '')) {
      send(buildError('bad_request'));
      return;
    }
    try {
      request.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      send(buildError('bad_request'));
      return;
    }

    if (req.url !== '/' && req.url !== '/exec') {
      res.writeHead(404);
      send(buildError('bad_request'));
      return;
    }
    processed = true;
    if (request.body.passphrase !== passphrase) {
      reply({ ...buildError('bad_passphrase'), message: badMessage });
      return;
    }
    const email = normalizeEmail(request.body.email);
    if (!isGmail(email)) {
      reply(buildError('not_gmail'));
      return;
    }
    const existing = assignments.has(email);
    if (!existing) assignments.set(email, `MOCK-${assignments.size + 1}`);
    const result = buildSuccess(assignments.get(email), existing);
    result.steps = [`1. ${step}`, '適用を確認する 🌧'];
    reply(result);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}`, requests };
}

module.exports = { startMockServer, passphrase, step, badMessage };
