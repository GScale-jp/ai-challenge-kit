# ai-challenge-voucher（GAS）

Google Cloud クレジットのクーポンコードを、合言葉と個人 Gmail で 1人1枚払い出す Web API。
ロジックは `src/core.js`（純粋関数・Node でテスト可）、GAS 固有部分は `src/Code.js`。

## 叩き方（POST は JSON、`-L` で 302 を追う）

```bash
U=$(python3 -c "import json;print(json.load(open('gas/endpoints.json'))['test'])")
curl -sL "$U"                                   # ヘルスチェック
curl -sL "$U" -H 'Content-Type: application/json' \
  --data '{"passphrase":"合言葉","email":"you@gmail.com","name":"任意"}'
```

重要:
- **`curl -X POST` を付けない。** GAS の /exec は POST を受けて 302 を返し、結果は転送先に GET で置かれる。`-X POST` を付けると転送先にも POST して 405 になる（しかも最初の POST は実行されている）。`--data` だけなら `-L` が GET に切り替える。
- 日本語の `name` を含めるときは UTF-8 のまま渡す。

PowerShell（7 以降で確認）:

```powershell
$u = "<endpoints.json の URL>"
Invoke-RestMethod -Uri $u                       # ヘルスチェック
$b = @{passphrase="合言葉"; email="you@gmail.com"; name="任意"} | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri $u -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($b))
```

応答は常に HTTP 200。`ok` で判定する（成功 `{ok:true, code, already_assigned, redeem_url, deadline, steps[]}`、失敗 `{ok:false, error, message}`）。
error: `bad_request` `bad_passphrase` `too_many_attempts` `rate_limited` `not_gmail` `closed` `sold_out` `server_busy` `server_error`。

## 設定
- 合言葉などは **シートの `config` タブ**（A列キー・B列値）: `PASSPHRASE`、`DEADLINE_ISO`（既定 `2026-11-21T00:00:00+09:00`）。書き換えるとすぐ効く。Script Properties に `PASSPHRASE` を置けばそちらが優先。
- シート ID は `gas/env/<test|prod>.js`（`gas/env/example.js` をコピーして作る。`deploy.sh` が `src/env.js` にコピー）。`clasp.<test|prod>.json` は `clasp.example.json` から作る。どちらもコミットしない。
- `codes` タブ（`code, email, name, assigned_at`）と `log` タブ（時刻・email・結果・理由・name。合言葉は残さない）。

## デプロイ
`gas/deploy.sh test|prod`（テスト実行 → `clasp push` → 既存 deployment を `redeploy`）。scriptId と deploymentId は `gas/clasp.<env>.json`、URL は `gas/endpoints.json`。
新しいスクリプトの初回は、所有者が /exec を一度ブラウザで開いて権限（スプレッドシート）を承認する。

## テスト
`npm test`、または `node --test gas/test`。
