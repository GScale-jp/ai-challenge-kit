---
name: voucher
description: 11/20 の勉強会で配られる Google Cloud クレジットのコードを受け取り、有効化の手順を案内する。「クレジットを受け取りたい」「Google Cloud のコードがほしい」「合言葉を入れたい」と言われたとき、または /ai-challenge-kit:voucher と入力されたときに使う。
---

# /ai-challenge-kit:voucher Google Cloud クレジットの受け取りと有効化

会場で伝えられる合言葉を使って、クレジットのコードを受け取り、有効化の手順を案内する。

## 先に伝えること

- **カード登録と、請求先アカウントのアップグレードの確定は、本人の操作**。このスキルは代行しない。
- クレジットは**個人の Gmail アカウント（@gmail.com）**にしか適用できない。会社や学校の Google アカウントでは適用できない。
- 適用の期限は **2026/11/20**。クレジットは適用日から1か月有効。

## 手順

1. **合言葉**（会場で伝えられたもの）を聞く。次に、使う**個人の Gmail アドレス**を聞く。名前（呼び名でよい）も任意で聞く。質問は一度に1つ。
2. Gmail が `@gmail.com` で終わらないときは、API を呼ばずに止まる。理由を説明する（会社・学校の Google Workspace アカウントには適用できないため）。個人の Gmail を用意してから、もう一度 /ai-challenge-kit:voucher を呼ぶよう案内する。
3. スクリプトで払い出し API を呼ぶ。合言葉を会話の記録やファイルに残さないよう、スクリプトの引数で渡す。
   - **`<スキルのフォルダ>`** は、この `SKILL.md` が置かれているフォルダの絶対パス。Mac では通常 `$HOME/.gemini/config/plugins/ai-challenge-kit/skills/voucher`（Windows は `%USERPROFILE%\.gemini\config\plugins\ai-challenge-kit\skills\voucher`）。作業フォルダ（`~/ai-challenge`）には `scripts/` が無いので、`bash scripts/claim.sh` のような**相対パスでは動かない**。必ず絶対パスで、空白があっても動くよう引用符で囲んで呼ぶ。
   - Mac / Linux: `bash "<スキルのフォルダ>/scripts/claim.sh" --passphrase "<合言葉>" --email "<Gmail>" --name "<名前>"`
   - Windows PowerShell: `powershell -ExecutionPolicy Bypass -File "<スキルのフォルダ>\scripts\claim.ps1" -Passphrase "<合言葉>" -Email "<Gmail>" -Name "<名前>"`
   - 払い出し先の URL はスクリプトが `<スキルのフォルダ>/config/endpoints.json` から自分で読む。**`endpoints.json` を先に読んだり、URL を引数や環境変数で渡したりしない**。そのまま1回で呼ぶ。`--name` は聞いていなければ省いてよい。
   - 運営の動作確認のときだけ、Mac / Linux は `--test`、Windows は `-Test` を足すとテスト用の窓口に送る。参加者の受け取りには付けない。
   - 終了コード: 0=成功、1=サーバーが断った（合言葉違い・配布終了など）、2=Gmail ではない、3=URL が未設定、4=通信失敗。
4. 結果に応じて案内する。
   - 成功: 表示された**コード**を示す（すでに発行済みのメールなら、同じコードが返る旨を伝える）。コードはほかの人に見せない。
   - 合言葉が違う: 会場で伝えられた合言葉をもう一度確かめるよう伝える（回数が続くと一時的に受け付けられなくなる）。
   - 配布が終わった、受付が終了した: 運営に声をかけるよう伝える。
   - URL が未設定、通信失敗: 運営に声をかけるよう伝える。
5. 成功したら、次の4つの手順を番号つきで示す（早田さん〈Google〉から受け取った手順）。
   1. 個人の Gmail で Google Cloud コンソール（https://console.cloud.google.com）にログインし、**請求先アカウントを有料アカウントにアップグレード**する。クレジットの範囲内なら料金は発生しない。カードの登録は本人が行う。
   2. https://cloud.google.com/redeem を開き、受け取ったコードを入力する。
   3. コンソールの［お支払い］>［クレジット］で、適用されたことを確かめる。
   4. 適用は **2026/11/20 まで**。クレジットは**適用日から1か月**有効。超えた分は登録したお支払い方法に請求されるので、使い終わった**不要なリソースは削除**する。
6. redeem のページ（https://cloud.google.com/redeem）を**ブラウザで開いてよいか聞く**。「はい」と言われたときだけ開く。
   - Mac: `open "https://cloud.google.com/redeem"`
   - Windows: `Start-Process "https://cloud.google.com/redeem"`
   - Google Cloud Shell（環境変数 `CLOUD_SHELL` が `true`）: コマンドでは開けないので、URL を表示し、本人に自分の PC のブラウザで開いてもらう。
7. 最後に、**予算アラート**の設定を勧める。https://console.cloud.google.com/billing/budgets で、予算額（クレジットの額の半分など）とメール通知を設定しておくと、使いすぎに気づける。
8. `challenge/progress.md` があれば、① クレジット受取を「済」に更新する（コードそのものは書かない）。無ければ作らず、/ai-challenge-kit:challenge を勧める。

## 気をつけること

- コード、合言葉、API キーを、`challenge/` 配下のファイルやコミットに書かない。
- 請求先アカウントのアップグレードやカード登録の画面は、本人に操作してもらう。画面の操作を代行しない。
- 払い出し API が使えない事情（URL 未設定など）があっても、コードを推測したり、作ったりしない。
