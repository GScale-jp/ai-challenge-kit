---
name: lt-slides
description: 発表用のスライドと話す台本を作ります。「5分の LT に出たい」「発表スライドを作って」と言われたとき、または /ai-challenge-kit:lt-slides と入力されたときに使う。
---

# /ai-challenge-kit:lt-slides 5分の発表スライドを作る

2026年11月20日（金）の Jagu'e'r 沖縄分科会 Meetup（沖縄市コザ、KOZA BASECAMP）で話すためのスライドを作ります。LT（ライトニングトーク）は、短い持ち時間で話す発表です。

`<スキルのフォルダ>` は、この `SKILL.md` が置かれているフォルダの絶対パス（パソコン内での完全な場所）のことです。スクリプトは作業フォルダ（`challenge/` があるフォルダ）で実行し、`<スキルのフォルダ>` はスキルを読み込んだときに分かる実際のパスに置き換え、空白があっても動くよう引用符で囲みます。

## 手順

1. `challenge/idea.md`、`challenge/requirements.md`、`challenge/video_script.md`、`challenge/entry_form.json` があれば読みます。フォームの下書きが `challenge/entry_form.md` にあれば、それも読みます。話の根拠になる出来事やアプリの機能は、本人が話したことと資料で確認できる範囲で書きます。
2. 「自己紹介で、最初にどんな一言を伝えたいですか」と1問だけ聞きます。答えを待ってから次に進みます。氏名は本人が後で入れられるよう、`speaker` を空欄にしてもかまいません。
3. `<スキルのフォルダ>/templates/deck.sample.json` を土台に、`challenge/lt/deck.json` を書きます。JSON はスライドの見出し、本文、話す台本、秒数をまとめて持つファイルです。既にファイルがあれば中身を読み、本人が書いた内容を使います。
   - 見出しは「〜が〜になる」のように言い切ります。1枚の文字は少なくし、図や画面で見えることは発表のときに口で補います。見出しは8〜40字で末尾の「。」を省き、見出しと本文を合わせて120字以内にします。
   - デモには、本人が限定公開にした YouTube 動画の URL か、アプリの URL を使います。`entry_form.json` に `youtube_url` または `product_url` があれば使い、無ければ自己紹介の答えを待った後にデモの URL を1問だけ聞きます。
   - 最後のスライドには、応募フォームの URL（https://googlejp25.withgoogle.com/awards-form）とデモの URL を両方入れます。応募が済んでいると確認できたときは「応募しました」、これから応募する人には「応募します」の文面にします。
4. ワークスペース直下で次を実行します。検査で指摘されたスライドがあれば直し、もう一度検査します。スライドは5〜10枚、秒数の合計は300秒以内です。Playwright が入っていれば、見出しが右端ではみ出していないかも、描画して確かめます。入っていないときは「見出しのはみ出しの確認は未実施です」と表示されるので、手順5で入れたあとにもう一度検査します。

   ```sh
   node <スキルのフォルダ>/scripts/check_deck.mjs
   ```

5. 初回だけ、Playwright（ブラウザを操作する道具）と Chromium（PDF を作るブラウザ）を入れます。ワークスペース直下で、Mac はターミナル、Windows はコマンドプロンプトで1つ目のコマンドを実行して元の場所に戻ります。既に `challenge/lt/` に出力があれば中身を確認し、2つ目のコマンドを実行します。

   ```sh
   cd <スキルのフォルダ>/scripts && npm install && npx playwright install chromium
   ```

   ```sh
   node <スキルのフォルダ>/scripts/build_deck.mjs
   ```

6. `challenge/lt/lt.html` をブラウザで開きます。発表画面の表示にはインターネット接続が必要です。F キーで全画面にし、S キーで発表者ノートを開けます。印刷や会場で回線が使えないときは `challenge/lt/lt.pdf` を使います。 Google Cloud Shell（環境変数 `CLOUD_SHELL` が `true`）では、ワークスペース直下で `cloudshell download challenge/lt/lt.pdf` を実行して自分の PC に保存し、HTML の発表画面を見るときは `python3 -m http.server 8080 -d challenge/lt` を実行したまま、画面右上の「ウェブでプレビュー」から「ポート 8080 でプレビュー」を選び、`lt.html` を開きます。
7. `challenge/lt/script.md` を最初から声に出して読みます。デモの操作や画面を切り替える時間も含め、5分以内に収まるか練習するよう勧めます。
8. `challenge/progress.md` があれば「LT スライド」を「済」にします。該当の段がまだ無ければ「メモ」に「LT スライド：済（challenge/lt/lt.html）」を追記します。ファイルが無ければ作らず、/ai-challenge-kit:challenge を勧めます。

## 7枚の構成

1. 自己紹介と一言（intro）
2. 誰が何に困るか（problem）
3. どう解決するか（idea）
4. アプリを操作するか動画を見せる（demo）。デモの URL を載せます。
5. Google の AI を何に使ったか（google-ai）
6. これからどう広げたいか（future）
7. 応募状況と案内（apply）。応募フォームとデモの URL を載せます。

## 気をつけること

- 公式の案内は https://googlejp25.withgoogle.com/awards/ にあります。ログイン、課金、規約への同意、応募フォームの送信は本人が行います。
- API キー（AI を使うための合い鍵）やパスワードはファイルに書きません。会場で画面を見せる前に、映る個人情報を確認します。
