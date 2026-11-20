---
name: deploy
description: 「作ったアプリを公開したい」「公開用の URL がほしい」「同じ URL でアプリを更新したい」と言われたとき、または /ai-challenge-kit:deploy と入力されたときに使う。
---

# /ai-challenge-kit:deploy 作ったアプリの公開

**ログイン、課金や同意の確定、公開範囲の最終確認と公開操作は本人が行います。プラグインは代行しません。** デプロイとは、作ったアプリをサーバーに置き、URL から使えるようにすることです。

## 手順

1. `challenge/prototype_check.md` の `## 作る形` を読みます。ファイルや記録が無いときや、試作の点検後に作る形が変わったときは、「GAS Web アプリ、静的 Web アプリ、Cloud Run のどれを作りましたか」と一問だけ聞きます。
2. 公開するファイルに API キー（外部サービスを使うための鍵）、パスワード、個人情報、機密情報が含まれていないことを本人と確かめます。API キーやパスワードをファイルに書きません。
3. 選んだ形の手順だけを案内します。コマンドは本人が Mac のターミナルまたは Windows の PowerShell で1行ずつ実行します。
   1. **GAS Web アプリ** — GAS（Google Apps Script）は Google のサーバーで動く小さなプログラムです。`gas-app/` に `Code.gs`・`index.html`・`appsscript.json` を置きます。`npm i -g @google/clasp` で clasp（Apps Script をコマンドで扱う道具）を入れ、`clasp login` でログインし、[Apps Script のユーザー設定](https://script.google.com/home/usersettings) で Apps Script API をオンにします。[references/gas_deploy.md](references/gas_deploy.md) に沿って `scripts/deploy_gas.mjs` を使います。同じ URL で更新する場合は、同じ作業フォルダを使い `--update` を付けます。
   2. **静的 Web アプリ** — `app/` の HTML（画面を作るファイル）などを公開します。Google のプロジェクトで管理したい場合は Firebase Hosting、GitHub で公開できるファイルを管理したい場合は GitHub Pages を選びます。Firebase は `npx firebase-tools login` → `npx firebase-tools init hosting`（公開ディレクトリは `app`）→ `npx firebase-tools deploy` の順です。GitHub Pages は公開リポジトリ（誰でも見られるファイル置き場）を作り、［Settings］→［Pages］で公開します。[references/static_and_cloud_run.md](references/static_and_cloud_run.md) の静的 Web アプリの手順を読みます。
   3. **Cloud Run** — コンテナ（アプリを動かすのに必要なものをまとめた入れ物）を Google 上で動かすサービスです。`gcloud auth login` でログインし、クレジットを適用した請求先にひもづくプロジェクトを `gcloud config set project <ID>` で選びます。アプリのフォルダで `gcloud run deploy <名前> --source . --region asia-northeast1 --allow-unauthenticated` を実行すると、ログインなしでアクセスできる公開 URL になります。［お支払い］→［予算とアラート］で予算アラートを設定するよう勧めます。使い終わったら、本人が `gcloud run services delete <名前> --region asia-northeast1` で削除できます。詳しくは [references/static_and_cloud_run.md](references/static_and_cloud_run.md) の Cloud Run の手順を読みます。会場のクレジットは `/ai-challenge-kit:voucher` で受け取れます。2026/11/20 までに適用する必要があり、適用から1か月有効です。
4. 本人が公開先の URL を開き、意図した範囲で利用できることを確かめます。確認済みの URL と公開方法を `challenge/deploy.md` に残します。`challenge/` は必要なら作ります。以下の見出しを使い、前の記録があれば読んで更新します。

   - `# アプリの公開`
   - `## 公開方法`
   - `## URL`
   - `## 公開範囲`

5. `challenge/progress.md` があれば、デプロイの行に URL を記録します。行がなければ `## メモ` に「デプロイ先：」に続けて URL を書き、同じ記録があれば更新します。ファイルが無ければ作らず、`/ai-challenge-kit:challenge` を勧めます。
