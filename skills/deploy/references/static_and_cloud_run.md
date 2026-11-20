# 静的 Web アプリと Cloud Run の公開手順

## 静的 Web アプリを Firebase Hosting で公開

Firebase Hosting は HTML などのファイルを Google 上で公開するサービスです。Google のプロジェクトで公開先を管理するなら、この方法を選びます。

1. `app/index.html` を開き、アプリが動くことと、`app/` の中に API キーや個人情報が入っていないことを確かめます。
2. ワークスペース直下で `npx firebase-tools login` を実行します。ログインするアカウントは本人が選びます。`npx` は Node.js の道具を呼び出すコマンドです。
3. `npx firebase-tools init hosting` を実行します。公開する Firebase プロジェクトを選び、公開ディレクトリ（公開するフォルダ）に `app` を指定します。`index.html` を上書きするか聞かれたら、作ったアプリを残すため「いいえ」を選びます。
4. 公開先と公開するファイルを本人が確認し、`npx firebase-tools deploy` を実行します。同じ設定に他の Firebase サービスも含まれる場合は、Hosting だけを対象に `npx firebase-tools deploy --only hosting` を使います。表示された Hosting URL を開いて動作を確認します。[Firebase Hosting の公式手順](https://firebase.google.com/docs/hosting/quickstart)

## 静的 Web アプリを GitHub Pages で公開

GitHub Pages は GitHub のリポジトリ（ファイルをまとめて管理する場所）からサイトを公開する仕組みです。公開リポジトリでファイルも見せてよい場合は、この方法を選べます。

1. GitHub で公開リポジトリを1つ作ります。`app/` の中身をリポジトリの一番上に置き、`index.html` を含めます。誰でもファイルを見られるので、API キー、パスワード、個人情報、機密情報が混ざっていないことを確かめます。
2. リポジトリの［Settings］→［Pages］で、公開元に［Deploy from a branch］を選びます。ファイルを置いたブランチ（ファイルのまとまり）と `/(root)` を選び、本人が保存します。
3. 公開が終わったら、同じ画面に表示される URL を開き、HTML と画像が表示されることを確かめます。[GitHub Pages の公開元を選ぶ手順](https://docs.github.com/ja/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## サーバーを使うアプリを Cloud Run で公開

1. `gcloud --version` で Google Cloud CLI（Google Cloud をコマンドで扱う道具）が使えるか確認します。無ければ公式手順で Mac または Windows 向けのものを入れます。`gcloud auth login` は本人が実行します。クレジットを使うなら `/ai-challenge-kit:voucher` で受け取り、2026/11/20 までに適用します。適用から1か月有効です。[Google Cloud CLI のインストール手順](https://cloud.google.com/sdk/docs/install)
2. Google Cloud コンソールで、クレジットを適用した請求先アカウントに対象プロジェクトがひもづいているか確認します。［お支払い］→［予算とアラート］で予算と通知先を設定しておくと、使いすぎに気づけます。通知で利用は自動停止しません。
3. `gcloud config set project <ID>` を実行します。`<ID>` は Google Cloud コンソールで確認したプロジェクト ID に置き換えます。
4. アプリを動かすファイルが入った `app/` フォルダに移動します。API キーやパスワードが含まれていないことを確かめ、`<名前>` を自分で決めたサービス名に置き換えます。下のコマンドは東京のリージョン（サーバーを置く地域）を選び、ログインなしでアクセスできる公開 URL を発行します。対象のプロジェクト、課金、公開範囲を本人が確認してから実行します。

   ```text
   gcloud run deploy <名前> --source . --region asia-northeast1 --allow-unauthenticated
   ```

5. 表示された URL を開いて動作を確かめます。使い終わったら、対象のプロジェクトとサービス名を表示で確認してから、本人が次のコマンドでサービスを削除します。

   ```text
   gcloud run services delete <名前> --region asia-northeast1
   ```

[Cloud Run のソースからの公開手順](https://cloud.google.com/run/docs/deploying-source-code)
