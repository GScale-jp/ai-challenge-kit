# Google Cloud Shell で AI Challenge キットを使う

この資料は、Google Cloud Shell で AI Challenge キットを使う手順です。Google Cloud Shell は、ブラウザの中で使える Google の無料の作業用パソコンです。

自分の PC に何も入れずに、ブラウザだけで進められます。

下のボタンを押して、個人の Gmail でログインしてください。表示される手順に沿ってコマンドを1つ実行し、Antigravity にログインします。

[![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://shell.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https%3A%2F%2Fgithub.com%2FGScale-jp%2Fai-challenge-kit&cloudshell_git_branch=main&cloudshell_tutorial=docs%2Fcloudshell-tutorial.md&cloudshell_workspace=.)

## Cloud Shell を開く

1. 上のボタンを押します。
2. 個人の Gmail（@gmail.com）でログインします。会社や学校のアカウントでは、管理者の設定で Cloud Shell が使えないことがあります。
3. 初めて使うときは、利用規約への同意を求められます。内容を読んで、ご自身で同意してください。
4. 「Cloud Shell で開く」という確認が出たら、「リポジトリを信頼する」にチェックを入れてから「確認」を押します。チェックを入れないと一時的な環境（画面の上に「エフェメラル」と出ます）で開きます。その場合、閉じると作ったものが全部消えます。
5. 「Cloud Shell の承認」という確認が出たら、「承認」を押します。

開くと、画面が3つに分かれます。左はエディタで、ファイルを見る画面です。下はターミナルで、コマンドを入力する黒い画面です。コマンドは、コンピューターに出す命令の文字です。右には手順（チュートリアル）が出ます。

## インストール

1. 右側の手順で、コマンドの横にあるボタンを押します。コマンドがターミナルに貼られます。
2. Enter を押します。

ボタンを使わずに、ターミナルに次のコマンドを貼って Enter を押しても同じです。自分で Cloud Shell を開いた場合も、この1行で入ります。

```
curl -fsSL https://raw.githubusercontent.com/GScale-jp/ai-challenge-kit/main/install/install.sh | bash -s -- --yes
```

Cloud Shell には、Antigravity の CLI が最初から入っています。CLI はターミナルで使う版のことで、コマンド名は agy です。インストールでは、次の3つを行います。

- キットを入れます。キットは Antigravity に機能を足すプラグイン（追加の部品）です。
- 作業フォルダ ~/ai-challenge を作ります。
- Playwright と Chromium を入れます。Playwright はブラウザを自動で操作する道具で、Chromium はブラウザです。動画、スライド、画面の確認に使います。

1分ほどで終わり、次の手順の案内が出ます。画面確認・動画・スライドで使う部品は裏でダウンロードが続くので、待たずに先へ進んでください（進み具合は `tail -f ~/.cache/ai-challenge-kit/setup.log` で見られます）。

2回目以降に同じボタンで開いたときは、インストールをやり直さなくてかまいません。作ったものと道具は残っています。キットを最新にしたいときだけ、同じコマンドをもう一度実行してください。

## Antigravity にログイン

1. ターミナルで次のコマンドを実行します。

```
cd ~/ai-challenge && agy
```

2. 「Select login method」と出たら、「1. Google OAuth」を選んで Enter を押します。
3. 長い URL と「Click here to authenticate」が出ます。リンクをクリックします。開かないときは、URL をコピーしてブラウザの新しいタブに貼ります。
4. Google のログイン画面で Gmail を選び、許可します。
5. 画面に出たコード（authorization code）をコピーします。
6. ターミナルの「authorization code...」の欄にコードを貼り、Enter を押します。

2番目の「Use a Google Cloud project」は選ばないでください。この手順では扱いません。

## キットを始める

1. Antigravity の入力欄に次の文字を入力し、Enter を押します。/aic まで打つと候補が出るので、そこから選んでもかまいません。

```
/ai-challenge-kit:challenge
```

2. 進み具合の表と「次にやること」が1つ出ます。示されたとおりに進めてください。

/challenge だけでは動きません。

## Google Cloud クレジットを受け取る

1. Antigravity の入力欄に次の文字を入力します。

```
/ai-challenge-kit:voucher
```

2. 合言葉を入力します。合言葉は会場で案内します。

受け取りには Gmail（@gmail.com）が必要です。

受け取った後に開く redeem のページは、Cloud Shell からは自動で開けません。表示された URL を、自分のブラウザで開いてください。

## 作ったアプリを確かめる

Cloud Shell の中のファイルは、そのままでは自分のブラウザで開けません。「ウェブでプレビュー」を使って開きます。

1. ターミナルのタブを「＋」で増やします。Antigravity を使っているターミナルとは別のタブで実行するためです。
2. 新しいタブで次のコマンドを実行し、そのままにしておきます。

```
cd ~/ai-challenge && python3 -m http.server 8080 -d app
```

3. Cloud Shell の画面右上の「ウェブでプレビュー」ボタン（目のようなアイコン）を押します。
4. 「ポート 8080 でプレビュー」を選ぶと、新しいタブでアプリが開きます。

止めるときは、そのターミナルで Ctrl + C を押します。

キットが自動で行う画面の確認は、Cloud Shell でもそのまま動きます。エラーがないかの確認と画面の写真の撮影は、実際に動くことを確かめました。

## 動画・スライド・応募フォームの注意

Cloud Shell のブラウザは、画面のない形（ヘッドレス）で動きます。自分の目の前には表示されません。

動画（/ai-challenge-kit:make-video）とスライド（/ai-challenge-kit:lt-slides）は、ファイルとしてできあがります。自分の PC に保存するには、ターミナルで次のコマンドを実行します。

動画の場合:

```
cloudshell download challenge/demo.webm
```

スライドの PDF の場合:

```
cloudshell download challenge/lt/lt.pdf
```

Cloud Shell の左のエディタで、ファイルを右クリックして「ダウンロード」を選んでも保存できます。

応募フォームへの自動入力（/ai-challenge-kit:entry-submit）は、Cloud Shell では使いません。キットが項目ごとにコピーしやすい形で文章を出します。自分の PC のブラウザで公式の応募フォームを開き、その文章を貼り付けてください。同意3点のチェックと送信は、ご自身で行います。

画面を録画して動画を撮る場合は、自分の PC の画面録画機能で「ウェブでプレビュー」のタブを録画してください。

## 困ったとき

何も操作しないまま40分たつと、Cloud Shell が止まります（公式の上限）。ボタンを押すか、ブラウザを再読み込みして開き直してください。次のコマンドで、前の会話の続きから再開できます。-c は直前の会話を続ける指定です。

```
cd ~/ai-challenge && agy -c
```

利用時間には公式の上限があります。1回の利用は最長12時間で、1週間の利用は合計50時間までです。

ホームフォルダ（~）の中に置いたものは残ります。ホームフォルダの外に置いたものは、セッションが終わると消えます。作ったものは ~/ai-challenge に置いてください。

ホームフォルダの容量は 5GB です。

120日使わないと、ホームフォルダは削除されます。削除の前にメールが届きます。応募が終わったら、動画やスライドを自分の PC に保存しておいてください。

agy がログインを求めてきたら、「Antigravity にログイン」の手順でもう一度ログインします。

画面の上に「エフェメラル」と出ているときは、「リポジトリを信頼する」にチェックを入れずに開いています。作ったものが残らないので、ボタンからもう一度開き直し、チェックを入れてください。
