# AI Challenge キットを Cloud Shell で使う

## はじめに

<walkthrough-tutorial-duration duration="15"></walkthrough-tutorial-duration>

この手順では、ブラウザだけで AI Challenge キットを使います。

Cloud Shell は個人の Gmail（@gmail.com）で使います。

画面の上に「エフェメラル」と出ていないことを確かめてください。出ているときは、作ったものが残りません。ボタンからもう一度開き直し、「リポジトリを信頼する」にチェックを入れてから「確認」を押します。

2回目以降は、次のインストールのページを飛ばしてかまいません。

## インストール

下のコマンドの横のボタンを押すと、コマンドがターミナルに貼られます。ターミナルは、下に出ている黒い画面です。Enter を押してください。

```bash
curl -fsSL https://raw.githubusercontent.com/GScale-jp/ai-challenge-kit/main/install/install.sh | bash -s -- --yes
```

1分ほどで終わり、次の手順の案内が出ます。画面確認・動画・スライドで使う部品は裏でダウンロードが続くので、待たずに先へ進んでください（進み具合は `tail -f ~/.cache/ai-challenge-kit/setup.log` で見られます）。

## Antigravity にログイン

次のコマンドを実行します。

```bash
cd ~/ai-challenge && agy
```

「1. Google OAuth」を選んで Enter を押します。出てきたリンクを開いて Gmail でログインし、許可します。表示されたコードをターミナルの「authorization code...」の欄に貼り、Enter を押します。

「Use a Google Cloud project」は選びません。

## キットを始める

Antigravity の入力欄に次の文字を入力し、Enter を押します。

```
/ai-challenge-kit:challenge
```

進み具合の表と「次にやること」が出るので、そのとおりに進めます。

Google Cloud クレジットは /ai-challenge-kit:voucher で受け取ります。合言葉は会場で案内します。

## アプリを確かめる

ターミナルのタブを「＋」で増やし、次のコマンドを実行したままにします。

```bash
cd ~/ai-challenge && python3 -m http.server 8080 -d app
```

画面右上の「ウェブでプレビュー」<walkthrough-web-preview-icon></walkthrough-web-preview-icon> から「ポート 8080 でプレビュー」を選ぶと、アプリが開きます。止めるときは Ctrl + C を押します。

## 困ったとき

40分操作しないと Cloud Shell が止まります。開き直したら、次のコマンドで前の会話の続きから再開できます。

```bash
cd ~/ai-challenge && agy -c
```

作ったものは ~/ai-challenge に置いてください。応募が終わったら、動画やスライドを自分の PC に保存しておきます。

<walkthrough-conclusion-trophy></walkthrough-conclusion-trophy>
