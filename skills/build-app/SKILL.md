---
name: build-app
description: challenge/requirements.md をもとに、動画で見せられる最小のアプリ（静的 Web アプリの app/index.html、または GAS Web アプリの gas-app/）を作る。「アプリを作って」「要件ができた、次は？」と言われたとき、または /ai-challenge-kit:build-app と入力されたときに使う。Gemini を使う機能は API キーを画面で入力する（または GAS のスクリプトプロパティに置く）方式にする。
---

# /ai-challenge-kit:build-app 要件からアプリを作る

`challenge/requirements.md` の内容から、動画で見せられる最小のアプリを作ります。作る形は `challenge/prototype_check.md` の「作る形」に従います。

`<スキルのフォルダ>` は、この `SKILL.md` が置かれているフォルダの絶対パス（パソコン内での完全な場所）のことです。スクリプトは作業フォルダ（`challenge/` があるフォルダ）で実行し、`<スキルのフォルダ>` はスキルを読み込んだときに分かる実際のパスに置き換え、空白があっても動くよう引用符で囲みます。

## 手順

1. `challenge/requirements.md` を読む。無ければ「先に /ai-challenge-kit:kabeuchi で要件を決めましょう」と案内して止まる。「5. ユーザーストーリー（3つ）」「6. 受け入れ条件」「7. 作らないこと」「8. 画面の流れ」「9. データ」を作るものの範囲とし、広げない。
2. `challenge/prototype_check.md` があれば「作る形」を読む。**GAS Web アプリ**（GAS は Google Apps Script、Google のサーバーで動く小さなプログラム）なら `gas-app/`、**静的 Web アプリ**（HTML だけで動くアプリ）なら `app/` に作る。Cloud Run と書いてある場合は、まず静的 Web アプリの形で画面を作り、サーバー側が要る部分は /ai-challenge-kit:deploy の手順で扱うと伝える。ファイルが無いときは「GAS と静的 Web アプリのどちらで作りますか。迷うなら静的 Web アプリです」と一問だけ聞く。
3. **実装の前に、公式ドキュメントで確かめる。** 使う仕組みの書き方を記憶だけで書かず、公式の説明で確認してから書く。確認した URL は、作ったアプリのコメントか `challenge/progress.md` のメモに残す。
   - Gemini API を呼ぶとき: https://ai.google.dev/gemini-api/docs （モデル名・URL・リクエストの形）
   - GAS: https://developers.google.com/apps-script （`doGet`、`HtmlService`、`SpreadsheetApp`、`UrlFetchApp`、`PropertiesService`）
   - 使う外部ライブラリは、公式の配布ページでバージョンを確かめる。確かめられなければ使わず、素の JavaScript で書く。
4. 作るものを3行で参加者に伝え、**確認を待たずにそのまま作り始める**（「作ってよいですか」とは聞かない。直したいところは、作った後に受け付ける）。
5. 次の決まりで作る。
   - 日本語の画面にする。スマホの幅でも崩れないようにする。文字は大きく、操作は少なく。見た目は動画で映えるように、色数を絞ってきれいにまとめる。
   - 外部ライブラリは CDN（ライブラリを配っているサーバー）から読んでよい。バージョンを固定して書く。ビルド作業やパッケージのインストールを要求しない。
   - **静的 Web アプリ（`app/`）**: `index.html` 1枚で動くことを基本とし、必要なら `app.js`・`style.css` に分ける。状態はブラウザの localStorage（ブラウザの中の小さな保存場所）に置く。アクセスできない場合に備えて try/catch で包み、動かなくならないようにする。
   - **GAS Web アプリ（`gas-app/`）**: `Code.gs`（`doGet` で `index.html` を返す。データを表に置くなら `SpreadsheetApp`）、`index.html`、`appsscript.json`（`"timeZone": "Asia/Tokyo"`、`"runtimeVersion": "V8"`、`"webapp": {"executeAs": "USER_DEPLOYING", "access": "MYSELF"}`）の3つを置く。画面から `google.script.run` でサーバー側の関数を呼ぶ。公開は /ai-challenge-kit:deploy で行う。
6. **Gemini を呼ぶ機能を入れる場合**（requirements.md の「3. 使う Google の AI」が Gemini のとき）
   - **静的 Web アプリ**: Google AI Studio（https://aistudio.google.com/apikey）で作った API キー（AI を使うための合い鍵）を、**画面の入力欄**から受け取り、localStorage に保存して使う。画面にも説明を出す（「キーはこのブラウザの中にだけ保存されます」）。
   - **GAS**: キーは、本人が Apps Script の［プロジェクトの設定］→［スクリプト プロパティ］に `GEMINI_API_KEY` として登録し、`Code.gs` では `PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')` で読む。登録は本人の操作。**キーをチャットに貼らせない。**
   - どちらも、キーをソースコードやファイルに書かない。リポジトリにコミットしない。
   - キーが未入力・未登録のときも画面が動くように、**ダミー応答**を返す。画面にはダミーであることを小さく表示する。
   - Gemini API は `https://generativelanguage.googleapis.com/v1beta/models/<モデル名>:generateContent` に POST する。モデル名は定数にまとめ、冒頭のコメントで差し替え方を書く。**既定のモデル名は `gemini-3.8-flash`** にする。`gemini-2.5-flash` など古い名前を記憶から書かない。手順3で公式の一覧（https://ai.google.dev/gemini-api/docs/models）を開いて名前が現行か確かめ、違っていたら公式の推奨に合わせる。呼び出しに失敗したら、画面にやさしい日本語で理由（キー未入力、通信失敗など）を出し、ダミー応答に切り替える。
7. **AI が書いたコードの点検リスト**を、作り終えたあとに1つずつ確かめ、結果を参加者に短く報告する。1つでも満たさなければ直してから進む。
   - [ ] API キー・パスワード・個人情報・メールアドレスが、ソースコードにも画面の初期値にも書かれていない
   - [ ] 入力の検証がある（空欄・長すぎる文字・数字でない値を入れても壊れない）。画面に出す文字は、HTML として解釈されない形（`textContent`）で入れる
   - [ ] エラーのときに、画面にやさしい日本語の理由が出て、真っ白にならない
   - [ ] 要件の受け入れ条件（Given/When/Then）を、実際に動かして1つずつ確かめた。確かめていない条件は、確かめていないと言う
   - [ ] サンプルデータは架空で、実在の人名・店名・連絡先が入っていない
8. **動かして確かめる。** 確かめた結果は、「画面で確認済み」と「画面での確認は未実施」のどちらかをはっきり参加者に伝える。確認できていないのに「完成」「確認済み」と言わない。
   - 静的 Web アプリは、まず Playwright（ブラウザを自動で操作する道具）が入っているかを `ls "<スキルのフォルダ>/scripts/node_modules/playwright"` で確かめる。入っていなければ、次のように聞く。「画面の確認に使う道具（Playwright と Chromium）を入れます。数分かかり、数百MBの容量を使います。入れてよいですか」。**「はい」と言われたときだけ**、`<スキルのフォルダ>/scripts` で次を1行ずつ実行する（`&&` でつながない）。
     1. `npm install`
     2. `npx playwright install chromium`
   - 入ったら、ワークスペース直下で `node "<スキルのフォルダ>/scripts/check_app.mjs" app/index.html challenge/app.png` を実行する。終了コードが 0 ならエラーなし（画面の写真が `challenge/app.png` に残る）。1 なら出たエラーを直して、もう一度実行する。2 は Playwright か Chromium が無い（確認できていない）ので、上の入れ方に戻る。
   - 入れることを断られた、入れられなかった、GAS で自動確認できない、のいずれかのときは、**最初に「画面での確認は未実施です」と伝える**。そのうえで、静的 Web アプリは `app/index.html` をブラウザで開き、GAS は /ai-challenge-kit:deploy で公開してから URL を開いて、「最小の機能3つ」がすべて画面から操作でき、コンソールエラーが出ないことを参加者自身に目で確かめてもらう。確かめてもらった結果を聞くまでは、手順11で「済」にしない。
9. 静的 Web アプリの起動方法を OS 別に示す。
   - Mac / Windows 共通（Node.js がある場合）: ターミナルで `npx serve app` を実行し、表示された URL を開く
   - Python がある場合: `python -m http.server -d app 8000`（Windows は `py -m http.server -d app 8000`）を実行し、http://localhost:8000 を開く
   - どちらも無い場合: `app/index.html` をダブルクリックして、ブラウザで直接開く
   - **Google Cloud Shell の場合**（環境変数 `CLOUD_SHELL` が `true`）: Cloud Shell の中のファイルは手元のブラウザで直接開けない。ワークスペース直下で `python3 -m http.server 8080 -d app` を実行したままにし、Cloud Shell の画面右上の「ウェブでプレビュー」ボタンから「ポート 8080 でプレビュー」を選んで開くよう案内する（`localhost` の URL を案内しない）。止めるときは、そのターミナルで `Ctrl + C` を押す。Cloud Shell では Playwright と Chromium はインストーラが入れてあるので、手順8の確認はそのまま実行できる
10. 最後に「**動画で見せる操作手順**」を3つ、番号つきで書いて参加者に見せる（画面で何を押し、何が起きるか）。
11. `challenge/progress.md` があれば、画面で確認できていれば ⑤ アプリ作成を「済」にし（「画面での確認は未実施」のままなら「済」にせず、メモ欄に「作成済み・画面での確認は未実施」と書く）、メモ欄に動画で見せる操作手順3つを書き足す（無ければ作らず、/ai-challenge-kit:challenge を勧める）。
12. 次は、アプリの URL がほしければ `/ai-challenge-kit:deploy`、そうでなければ `/ai-challenge-kit:demo-video` と勧めて終わる。

## 気をつけること

- 作りすぎない。時間が足りないときは、機能を減らして先に動くものを見せる。
- 参加者の個人情報、実在の他人の名前、会社の機密をサンプルデータに使わない。
- 参加者が追加の希望を出したら、requirements.md の範囲かを確かめ、範囲外なら「動画の後で足せます」と答える。
- ログイン（Google アカウントや clasp のログインなど）、課金、規約への同意、公開の確定は本人が行う。代行しない。
