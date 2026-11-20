# Google AI Challenge キット

Google の AI コーディング環境 Antigravity のプラグインです。Google AI Challenge（締切 2026/11/30 23:59）に応募できる形まで、Antigravity の中で一気通貫で進められます。プログラミングが初めての人でも、画面の案内に沿って進められるようにしています。

- 身近な困りごとからアイデアを出し、今日作れるか点検する
- 壁打ち（AI との質問のやりとり）で要件を決め、アプリを作る
- 作ったアプリを公開して、URL を手に入れる
- 90秒のデモ動画を、台本から自動で作る
- 応募文を作り、応募フォームに入力する（同意と送信は自分で押します）
- 5分の LT（短い発表）用のスライドを作る
- Google Cloud クレジットの受け取りと有効化を案内する

使い方の動画（3分）: https://drive.google.com/file/d/18f6uWWWGPQ-Zk7yyZLBJwRM6qfP_4CUJ/view

応募条件は公式ページ https://googlejp25.withgoogle.com/awards/ に基づきます。提出物は、90秒以内のデモ動画（自分の YouTube に限定公開）と応募フォームです。審査はアイデア本位で、アプリの完成度は問われません。

## 最初の5分

1. **インストール**: 下の「インストール（1行）」を、Mac はターミナル、Windows は PowerShell に貼り付けて実行します。
2. **起動**: インストールが終わると作業用フォルダ `~/ai-challenge` が作られます。ターミナル（PowerShell）でそのフォルダに移動し、`agy` と入力して Antigravity を起動します。
3. **`/ai-challenge-kit:challenge` と入力**（`/aic` まで打つと候補が出るので、そこから `/ai-challenge-kit:challenge` を選んでもかまいません）: 進み具合の表が出て、「次にやること」が1つだけ示されます。あとは、示されたスキル（例: `/ai-challenge-kit:idea-spark`）を入力するだけです。

迷ったら、いつでも `/ai-challenge-kit:challenge` と入力してください。スキルの名前は、どれも `/ai-challenge-kit:` で始まります（`/challenge` だけでは動きません）。

## インストール（1行）

Mac / Linux（ターミナル）:

```
curl -fsSL https://raw.githubusercontent.com/GScale-jp/ai-challenge-kit/main/install/install.sh | bash
```

Windows（PowerShell）:

```
irm https://raw.githubusercontent.com/GScale-jp/ai-challenge-kit/main/install/install.ps1 | iex
```

Antigravity の CLI（`agy`）が無い場合は、公式インストーラを使ってよいか聞かれます。`y` を押すと入ります。聞かれずに進めたいときは、Mac / Linux は `bash -s -- --yes`、Windows は先に `$env:AICK_YES = "1"` を設定します。

インストールが終わると、作業用のフォルダ `~/ai-challenge`（Windows は `C:\Users\<名前>\ai-challenge`）が作られます。

## 使い方

1. 作業用フォルダで `agy` を起動し、`/ai-challenge-kit:challenge` と入力します。Antigravity を開いて、そのフォルダを開いてから `/ai-challenge-kit:challenge` と入力してもかまいません。
2. `/ai-challenge-kit:challenge` が進み具合を表で示し、「次にやること」を1つだけ示します。
3. 示された順に進めます。作業ファイルは、フォルダの中の `challenge/`（アプリは `app/` か `gas-app/`）に置かれます。

## 90分コース（時間がない人向け）

応募に必要なものだけを、次の6つで進めます。動画は画面録画で撮ります。

| 目安 | スキル | やること |
|---|---|---|
| 10分 | `/ai-challenge-kit:idea-spark` | 3つの質問に答えて、アイデアを1つ選ぶ |
| 15分 | `/ai-challenge-kit:kabeuchi` | 壁打ちで要件を決める |
| 25分 | `/ai-challenge-kit:build-app` | アプリを作る |
| 15分 | `/ai-challenge-kit:demo-video` | 90秒の台本を作り、画面録画して YouTube に限定公開でアップする |
| 10分 | `/ai-challenge-kit:entry-form` | 応募フォームに入れる文章を作る |
| 15分 | `/ai-challenge-kit:entry-submit` | 応募フォームに入力し、最後は自分で送信する |

`/ai-challenge-kit:challenge` に「90分しかない」と伝えると、このコースで案内します。

## フルコース

11の段を順に進めます。⑥⑧⑪は、必要な人だけで大丈夫です。

| 段 | スキル | 内容 |
|---|---|---|
| ① | `/ai-challenge-kit:voucher` | Google Cloud クレジットを受け取る（任意） |
| ② | `/ai-challenge-kit:idea-spark` | 身近な困りごとからアイデアを出す |
| ③ | `/ai-challenge-kit:prototype-check` | 作り始める前に、今日作れるか点検する |
| ④ | `/ai-challenge-kit:kabeuchi` | 壁打ちで要件を決める |
| ⑤ | `/ai-challenge-kit:build-app` | アプリを作る |
| ⑥ | `/ai-challenge-kit:deploy` | 作ったアプリを公開して URL を得る（任意） |
| ⑦ | `/ai-challenge-kit:demo-video` | 90秒の動画の台本を作る |
| ⑧ | `/ai-challenge-kit:make-video` | 台本から動画ファイルを自動で作る（画面録画でもよい） |
| ⑨ | `/ai-challenge-kit:entry-form` | 応募フォームに入れる文章を作る |
| ⑩ | `/ai-challenge-kit:entry-submit` | 応募フォームに入力する（同意と送信は自分で） |
| ⑪ | `/ai-challenge-kit:lt-slides` | 5分の LT スライドを作る（11/20 の発表用） |

## スキル一覧（全12）

| スキル | 何をするか | できるもの |
|---|---|---|
| `/ai-challenge-kit:challenge` | 全体の案内。11の段の進み具合を示し、次の一手を1つだけ示す | `challenge/progress.md` |
| `/ai-challenge-kit:idea-spark` | 3つの質問に答えると、コザの題材も混ぜたアイデアカードが出る。1つ選ぶ | `challenge/idea.md` |
| `/ai-challenge-kit:prototype-check` | 今日2時間で動くか、動画で見せられるか、審査基準にどう答えるかを点検し、作る形（GAS・静的 Web・Cloud Run）を1つ勧める | `challenge/prototype_check.md` |
| `/ai-challenge-kit:kabeuchi` | 要件定義の壁打ち。7つの質問に1問ずつ答える。「おまかせ」で例題でも進められる | `challenge/requirements.md` |
| `/ai-challenge-kit:build-app` | 要件から、動画で見せられる最小のアプリを作る。作ったあとに点検リストで確かめる | `app/index.html` または `gas-app/` |
| `/ai-challenge-kit:deploy` | 作ったアプリを公開する3つの方法（GAS・Firebase か GitHub Pages・Cloud Run）を案内する | `challenge/deploy.md` |
| `/ai-challenge-kit:demo-video` | 90秒の台本、画面録画の方法、YouTube への限定公開の手順 | `challenge/video_script.md` |
| `/ai-challenge-kit:make-video` | 台本から、字幕とアプリの操作を録画した動画を自動で作る | `challenge/demo.webm` |
| `/ai-challenge-kit:entry-form` | タイトル案3つ、概要、PR の3欄など、フォームの下書き | `challenge/entry_form.md`・`entry_form.json` |
| `/ai-challenge-kit:entry-submit` | 下書きを応募フォームに入力する。同意のチェックと送信ボタンは押さない | （入力済みの画面） |
| `/ai-challenge-kit:lt-slides` | 5分の発表スライドと、話す台本を作る | `challenge/lt/lt.html`・`lt.pdf` |
| `/ai-challenge-kit:voucher` | Google Cloud クレジットのコードを受け取り、有効化の手順を案内する | （コードは画面にだけ表示） |

## 自分で押すもの

次の操作は、安全のため必ず自分で行います。このキットは代行しません。

- Google アカウントへのログイン、`clasp login` や `gcloud auth login` などのログイン
- カードの登録、請求先アカウントのアップグレード
- 応募フォームの同意3点のチェックと、「送信する」ボタン（締切後は直せません）
- YouTube の公開設定を「限定公開」にして保存する操作

API キー（AI を使うための合い鍵）やパスワードは、チャットに貼らず、ファイルにも書かないでください。

## Mac と Windows の違い

- ターミナルの種類が違います。Mac は「ターミナル」、Windows は「PowerShell」を使います。コマンドは同じものを貼り付けられます。
- Windows の PowerShell で `.ps1` の実行を止められたときは、`npm` を `npm.cmd`、`clasp` を `clasp.cmd` と書いてください。
- 画面録画は、Mac は `command + shift + 5`、Windows は `Win + Alt + R` です。
- インストールの1行は、Mac は `curl ... | bash`、Windows は `irm ... | iex` です。
- 作業用フォルダは、Mac は `~/ai-challenge`、Windows は `C:\Users\<名前>\ai-challenge` です。

## 初回だけ必要な準備（動画・フォーム入力・スライド）

`/ai-challenge-kit:make-video`・`/ai-challenge-kit:entry-submit`・`/ai-challenge-kit:lt-slides`・`/ai-challenge-kit:build-app` の動作確認は、Playwright（ブラウザを自動で操作する道具）と Chromium（そのブラウザ）を使います。初回だけ、次の2つのコマンドが必要です。**スキルが案内したときに、案内されたスキルのフォルダで実行してください。** 先に自分で実行しなくても大丈夫です。

```
cd <スキルのフォルダ>/scripts
npm install
npx playwright install chromium
```

`npm install` と `npx playwright install chromium` には Node.js（JavaScript を動かす道具）が必要です。無ければ https://nodejs.org/ から入れます。2回目以降は不要です。

## Google Cloud クレジットの注意

- 個人の Gmail アカウント（@gmail.com）にしか適用できません。会社や学校のアカウントは使えません。
- 会場で伝えられる合言葉が必要です。
- 請求先アカウントのアップグレードとカード登録は、本人の操作です。このキットは代行しません。クレジットの範囲内なら料金は発生しません。
- 適用は 2026/11/20 までです。クレジットは適用日から1か月有効です。超えた分は登録したお支払い方法に請求されるので、不要なリソースは削除してください。
- 使いすぎに気づけるよう、予算アラート（https://console.cloud.google.com/billing/budgets ）を設定してください。

## アンインストール

Mac / Linux:

```
curl -fsSL https://raw.githubusercontent.com/GScale-jp/ai-challenge-kit/main/install/install.sh | bash -s -- --uninstall
```

Windows（PowerShell）:

```
$env:AICK_UNINSTALL = "1"; irm https://raw.githubusercontent.com/GScale-jp/ai-challenge-kit/main/install/install.ps1 | iex
```

または `agy plugin uninstall ai-challenge-kit` でも外せます。作業フォルダ `~/ai-challenge` は消えません。

## うまく動かないとき

- `agy` が見つからない: ターミナル（PowerShell）を開き直してください。Windows では `%LOCALAPPDATA%\agy\bin` に入ります。
- GitHub から入らない: インストーラが自動で zip の取得に切り替えます。それでも失敗するときは、ネットワークを確かめて、もう一度実行してください。
- 更新したい: もう一度インストールの1行を実行してください。古いものを外して入れ直します。
- スキルを呼んでも反応がない: `agy plugin list` で `ai-challenge-kit` が入っているか確かめてください。
- `npm install` や `npx playwright install chromium` が失敗する: Node.js が入っているか（`node --version` で確認）、ネットワークにつながっているかを確かめて、もう一度実行してください。
- 動画やスライドの作成で「Playwright を読み込めません」と出る: 上の「初回だけ必要な準備」を、そのスキルのフォルダで実行してください。
- Mac で動画の作成が権限のエラーで止まる: ターミナルを開き直して、もう一度実行してください。
- 応募フォームの入力欄が見つからない: スキルが、項目ごとにコピーしやすい形で文章を表示します。公式のフォームに手で貼り付けてください。
- クレジットが受け取れない: 合言葉、Gmail（@gmail.com）を確かめてください。解決しないときは、会場の運営に声をかけてください。

## 開発者向け

```
npm ci --prefix skills/make-video/scripts && npx --prefix skills/make-video/scripts playwright install chromium   # 初回のみ（lt-slides・entry-submit・build-app の scripts でも npm ci）
npm test                  # 静的検査・インストーラ・払い出し・各スキルのスクリプトの検査（Mac / Linux / Windows）
bash e2e/run_e2e.sh       # Mac 実機で、本物の agy を使った全工程の通し検査（出力は .e2e-out/<日時>/）
env -u AGY_ADC_AUTH agy plugin validate . --strict
```

`e2e/run_e2e.sh` は、例題（台風の前の家族の備え）で、アイデア出しから LT スライドまでを通します。デプロイは GAS の dry-run だけ、フォーム入力はローカルのダミーフォームだけで、本物の公式フォームには入力しません。クレジット受取は、環境変数 `AICK_VOUCHER_URL` にテスト API の URL があるときだけ実行します。

`gas/` は、クレジットのコードを払い出す API（Google Apps Script）です。
