---
name: demo-video
description: Google AI Challenge に出す90秒のデモ動画の台本を作り、画面録画の方法と YouTube への限定公開の手順を案内する。「動画の台本」「デモ動画を作りたい」「録画のやり方」「YouTube にあげたい」と言われたとき、または /ai-challenge-kit:demo-video と入力されたときに使う。
---

# /ai-challenge-kit:demo-video 90秒デモ動画の台本

提出する動画は **90秒以内**。**自分の YouTube に「限定公開」**でアップし、その URL をフォームに入れる。**Google の AI を使っている画面**が映っていること。

## 手順

1. `challenge/requirements.md` を読む（無ければ /ai-challenge-kit:kabeuchi を案内して止まる）。`challenge/progress.md` に「動画で見せる操作手順」があれば、それも読む。
2. `challenge/video_script.md` に、次の見出しと構成で台本を書く。

   - `# 90秒デモ動画の台本`
   - `## 全体`: 一言で、誰のどんな困りごとを、Google の AI でどう解決するか
   - `## 0〜15秒　困りごと`: 画面とナレーション
   - `## 15〜70秒　Google の AI を使っている画面`: 画面（Antigravity でアプリを作る様子〈15〜35秒〉、アプリを操作する様子〈35〜70秒〉）とナレーション
   - `## 70〜90秒　誰がどう助かるか・ほかにも広がること`: 画面とナレーション
   - `## 録画の方法`
   - `## YouTube に限定公開でアップする手順`
   - `## 提出前チェック`
   - `## 自動作成用の場面データ`（手順7。/ai-challenge-kit:make-video が動画を自動で作るときに読む）

3. 各区間は、画面に何を映すかとナレーションの文を、声に出して読んで区間の秒数に収まる分量で書く（目安は1秒に4〜5文字。0〜15秒で約60〜70文字、15〜70秒で約250〜300文字、70〜90秒で約90〜100文字）。ナレーションは requirements.md の参加者の言葉を使い、具体的な場面（誰が・いつ・何に困るか）を入れる。
4. 「録画の方法」に OS 別の手順を書く。
   - Mac: `command + shift + 5` で画面収録を始める。終了はメニューバーの停止ボタン。保存先はデスクトップ
   - Windows: `Win + Alt + R`（Xbox Game Bar）で録画の開始と停止。または Snipping Tool（切り取り&スケッチ）の録画機能
   - スマホで撮影してもよい（画面を横向きにして、手ぶれに注意）
   - 声は、録画しながら話すか、あとで編集アプリで重ねる。静かな場所で、マイクに近づいて話す
   - 90秒を超えたら、前半の間（ま）を詰めて撮り直す。編集が難しければ、台本の文を削る
5. 「YouTube に限定公開でアップする手順」に次を書く。
   1. YouTube Studio（https://studio.youtube.com）を開く（Google アカウントでログイン）
   2. 右上の［作成］→［動画をアップロード］
   3. ファイルを選ぶ。タイトルを入れる。「子供向けか」には、該当しないを選ぶ
   4. 公開設定で**［限定公開］**を選んで保存する
   5. 表示された動画のリンクをコピーする（フォームの「動画 URL」に使う）
6. 「提出前チェック」に、次の項目をチェックボックスで書く。
   - [ ] 90秒以内
   - [ ] Google の AI を使っている画面が映っている
   - [ ] 限定公開でアップした
   - [ ] 他人の顔・名前・連絡先、会社の機密が映っていない
   - [ ] API キーの文字列が映っていない（入力欄は隠す）
7. **台本の末尾に `## 自動作成用の場面データ` を書く**（/ai-challenge-kit:make-video がこの JSON を読んで動画を自動で作る）。JSON は、録画する順番や操作を道具に伝える書き方で、見出しの直後に ```` ```json ```` のブロックを1つだけ置く。形は次のとおり。秒数は、導入（intro）と3つの場面を足して **90秒以内**にし、台本の区間（困りごと・AI の画面・広がり）に対応させる。アプリの `selector`（押すボタンや入力欄の目印）は、作ったアプリの実際の `id` などに合わせる。操作が無い場面は `steps` を書かず、字幕だけにする。

   ````markdown
   ## 自動作成用の場面データ

   ```json
   {
     "appUrl": "app/index.html",
     "intro": { "title": "Antigravity で作りました", "caption": "（一言）", "seconds": 8 },
     "scenes": [
       { "id": "problem", "title": "（困りごと）", "caption": "（字幕）", "seconds": 12 },
       { "id": "demo", "title": "（AI を使う場面）", "caption": "（字幕）", "seconds": 45,
         "steps": [
           { "action": "click", "selector": "#start" },
           { "action": "fill", "selector": "#people", "text": "4" },
           { "action": "press", "key": "Enter" },
           { "action": "wait", "ms": 800 }
         ]
       },
       { "id": "wrapup", "title": "（誰がどう助かるか）", "caption": "（字幕）", "seconds": 18 }
     ],
     "antigravityClip": null
   }
   ```
   ````

   - `action` は `click`（押す）・`fill`（入力する）・`press`（キーを押す）・`wait`（待つ）の4つだけ。
   - `appUrl` は、静的 Web アプリなら `app/index.html`、/ai-challenge-kit:deploy で公開した URL があればその URL。
   - 字幕とタイトルは、台本のナレーションの要点を声に出して読める長さにする。API キーや個人情報を入れない。
8. `challenge/progress.md` があれば、⑦ 動画の台本を「済」に更新する（無ければ作らず、/ai-challenge-kit:challenge を勧める）。
9. 次は、動画を自動で作るなら `/ai-challenge-kit:make-video`、画面を自分で録画するなら録画してアップロードしたあとで `/ai-challenge-kit:entry-form` と勧めて終わる。

## 気をつけること

- 動画の撮影や編集・アップロードは本人の操作。代行しない。
- 録画の画面に API キー・クレジットのコード・個人のメールアドレスが映らないよう、注意を一言添える。
