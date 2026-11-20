# GAS Web アプリを公開する手順

## 初めて公開するとき

1. ワークスペース直下の `gas-app/` に `Code.gs`、`index.html`、`appsscript.json` があることを確かめます。`appsscript.json` は Apps Script の設定ファイルです。API キーやパスワードが入っていたら、公開前にファイルから取り除きます。
2. Mac のターミナルまたは Windows の PowerShell で `node --version` を実行し、Node.js（JavaScript を動かす道具）が20以上であることを確認します。`npm i -g @google/clasp` で clasp を入れ、`clasp --version` で 3.x と表示されることを確認します。npm は Node.js と一緒に使える、道具を入れるためのコマンドです。Windows で PowerShell が `.ps1` の実行を止める場合は、`npm.cmd` と `clasp.cmd` を使います。
3. 自分で `clasp login` を実行し、公開に使う Google アカウントを選びます。[Apps Script のユーザー設定](https://script.google.com/home/usersettings) を同じアカウントで開き、Apps Script API をオンにします。
4. 公開範囲を選びます。`MYSELF` は自分だけ、`DOMAIN` は同じ組織内、`ANYONE` は Google アカウントでログインした人が対象です。設定ファイルの `webapp` に `"executeAs": "USER_DEPLOYING"` と、意図した `access` があるかを確かめます。`USER_DEPLOYING` は、公開した本人の権限でアプリが動く設定です。[Google の公開範囲の説明](https://developers.google.com/apps-script/manifest/web-app-api-executable)
5. ワークスペースのルートから次のコマンドで公開の予定を表示します。この例では `--access MYSELF` で自分だけが開けるようにします。`<スキルのフォルダ>` は、このスキルの `SKILL.md` があるフォルダの絶対パスに置き換え、空白があれば引用符で囲みます。

   ```text
   node <スキルのフォルダ>/scripts/deploy_gas.mjs --title "備え分担アプリ" --access MYSELF --dry-run
   ```

6. 公開範囲とコマンドを本人が確認したら、`--dry-run` を外して自分で実行します。`gas-app/` は元のファイル、`.gas-deploy/` は作業用のコピーです。`--src` や `--dest` で場所を変える場合は、`--dest` に専用の作業フォルダを指定します。実行前にフォルダの中身を確認してください。そこにあるファイルは `.clasp.json`（公開先のプロジェクトを覚えておくファイル）を残して入れ替わります。
7. 個人 Gmail で作ったアプリの URL は `https://script.google.com/macros/s/<デプロイID>/exec` の形です。デプロイ ID は公開した版を指す文字列です。出力にあるアプリの URL と Apps Script の編集画面 URL を確認し、アプリの URL を `challenge/deploy.md` に記録します。

## 同じ URL で更新するとき

1. `gas-app/` の内容を直します。以前の `.clasp.json` が入った同じ作業フォルダを使い、以前と同じ Google アカウントでログインします。ログイン時に `clasp -u <名前> login` と名前を付けた場合は、スクリプトにも `--user <名前>` を渡します。
2. 次を実行します。`--dest` を指定して公開した場合は同じ `--dest` を添えます。`--access` を省く場合は `gas-app/appsscript.json` に書いた公開範囲が使われます。

   ```text
   node <スキルのフォルダ>/scripts/deploy_gas.mjs --update --dry-run
   ```

3. `--update` は一覧の先頭にある番号付きの公開版を使います。公開版が複数あり、更新する版を自分で選びたいときは、Apps Script の［デプロイを管理］で対象を選んで更新します。番号付きの公開版が無いときはスクリプトが新しい公開版を作り、URL が新しく発行されます。
4. 公開範囲を本人が確認したら `--dry-run` を外して実行し、以前の URL で新しい内容が開くことを確かめます。

## うまくいかないとき

1. **Apps Script API がオフ** — [ユーザー設定](https://script.google.com/home/usersettings) をログインに使ったアカウントで開き、オンにします。
2. **ログインしたアカウントが違う** — `clasp show-authorized-user` で確認し、公開先を管理するアカウントで `clasp login` し直します。名前を付けてログインした場合は確認時にも `clasp -u <名前> show-authorized-user` とします。
3. **アクセスできない** — `appsscript.json` の `webapp.executeAs` が `USER_DEPLOYING` か、`webapp.access` が `ANYONE` または `MYSELF` など意図した値か、開いている URL の末尾が `/exec` かを確かめます。
4. **`--update` で `.clasp.json` が見つからない** — 以前の作業フォルダが残っているかを確かめ、既定の場所と異なる場合は `--dest` に指定します。
5. **中断後に「別の公開処理が実行中」と出る** — 公開コマンドがすべて終了していることを確かめます。作業フォルダに空の `.deploy.lock` フォルダが残っていれば、それを削除してから再実行します。
