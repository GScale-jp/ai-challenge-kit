---
name: challenge
description: Google AI Challenge への応募を最後まで進める全体の案内役。「応募したい」「何から始める？」「次は何？」「進み具合を見せて」と言われたとき、または /ai-challenge-kit:challenge と入力されたときに使う。challenge/progress.md を読み書きし、「次にやること」を1つだけ示す。
---

# /ai-challenge-kit:challenge 応募までの全体案内

Google AI Challenge（締切 2026/11/30 23:59）に応募できる形まで進めるための案内役。自分では作業せず、いまどこまで進んだかを示して、**「次にやること」を1つだけ**示す。11の段があるが、初心者には全部を見せて圧倒せず、表の下に次の1つだけを大きく書く。

応募条件・部門・審査基準の要約は `references/rules_summary.md` にある。参加者に聞かれたときや、段の説明に必要なときに読む。

## 手順

1. ワークスペース直下に `challenge/` があるか確かめる。
   - 無ければ作り、`challenge/progress.md` を下の「progress.md の形」で新規作成する（初回）。
   - あれば `challenge/progress.md` を読む。
2. ファイルの有無で進み具合を確認し、`progress.md` と食い違っていたら実際のファイルを優先して直す。
   - ① クレジット受取: `progress.md` に記録があるか（記録は /ai-challenge-kit:voucher が書く。無ければ「未」）
   - ② アイデア出し: `challenge/idea.md`
   - ③ 試作検討: `challenge/prototype_check.md`
   - ④ 壁打ち: `challenge/requirements.md`
   - ⑤ アプリ作成: `app/index.html` または `gas-app/Code.gs`
   - ⑥ デプロイ: `challenge/deploy.md`
   - ⑦ 動画の台本: `challenge/video_script.md`
   - ⑧ 動画の作成: `challenge/demo.webm`
   - ⑨ 応募文: `challenge/entry_form.md` と `challenge/entry_form.json`
   - ⑩ フォームに入力: `progress.md` に「済」の記録があるか（入力まで。送信は本人）
   - ⑪ LT スライド: `challenge/lt/lt.html`
3. 11の段の表を示す。状態は「済」「未」「いまここ」「飛ばしてよい」のどれか。

   | 段 | 内容 | 使うスキル | 状態 |
   |---|---|---|---|
   | ① | Google Cloud クレジットを受け取る（任意・会場配布分） | /ai-challenge-kit:voucher | |
   | ② | 身近な困りごとからアイデアを出す | /ai-challenge-kit:idea-spark | |
   | ③ | 作り始める前に、今日作れるか点検する | /ai-challenge-kit:prototype-check | |
   | ④ | 壁打ちで要件を決める | /ai-challenge-kit:kabeuchi | |
   | ⑤ | アプリを作る | /ai-challenge-kit:build-app | |
   | ⑥ | 作ったアプリを公開して URL を得る（任意） | /ai-challenge-kit:deploy | |
   | ⑦ | 90秒の動画の台本を作る | /ai-challenge-kit:demo-video | |
   | ⑧ | 台本から動画ファイルを作る（画面録画でもよい） | /ai-challenge-kit:make-video | |
   | ⑨ | 応募フォームに入れる文章を作る | /ai-challenge-kit:entry-form | |
   | ⑩ | 応募フォームに入力する（送信は本人） | /ai-challenge-kit:entry-submit | |
   | ⑪ | 5分の LT スライドを作る（11/20 の発表用） | /ai-challenge-kit:lt-slides | |

4. 今日の日付と締切（2026/11/30 23:59）から残り日数を計算して添える。残りが3日以下なら、「90分コース」（下記）で応募を先に終わらせるよう勧める。
5. **次にやること**を1つだけ、表の下に「次は /○○ と入力してください。〜をします（目安 N 分）」の形で示す。順番は ① → ② → ③ → ④ → ⑤ → ⑥ → ⑦ → ⑧ → ⑨ → ⑩ → ⑪ が基本。ただし次のとおり。
   - ①は、クレジットを使う予定があるとき（Gemini API の利用料を気にするとき、Google Cloud を使うとき）だけ勧める。
   - ⑥は、アプリに公開の URL がほしいとき（動画やフォームの「成果物 URL」に入れたいとき）だけ勧める。要らなければ「飛ばしてよい」にする。
   - ⑧は、画面録画で動画を作る人には「飛ばしてよい」。
   - ⑪は、11/20 の LT に出る人だけ勧める。
   - 参加者が選んだ順があればそれに従う。
6. `challenge/progress.md` を更新する。

## 90分コース

時間がない人向け。② → ④ → ⑤ → ⑦ → ⑨ → ⑩ の6つだけを進める（③⑥⑧⑪は飛ばす）。動画は画面録画で撮り、/ai-challenge-kit:demo-video の手順で YouTube に限定公開でアップする。参加者が「時間がない」「90分しかない」と言ったら、このコースを勧め、表の飛ばす段を「飛ばしてよい」にする。

| 目安 | 段 | スキル |
|---|---|---|
| 10分 | ② アイデア出し | /ai-challenge-kit:idea-spark |
| 15分 | ④ 壁打ち | /ai-challenge-kit:kabeuchi |
| 25分 | ⑤ アプリ作成 | /ai-challenge-kit:build-app |
| 15分 | ⑦ 動画の台本と録画・アップ | /ai-challenge-kit:demo-video |
| 10分 | ⑨ 応募文 | /ai-challenge-kit:entry-form |
| 15分 | ⑩ フォームに入力（送信は本人） | /ai-challenge-kit:entry-submit |

## progress.md の形

```
# 応募の進み具合

更新: YYYY-MM-DD HH:MM
締切: 2026-11-30 23:59（残り N 日）

| 段 | 内容 | 状態 | 成果物 |
|---|---|---|---|
| ① | クレジット受取 | 未 | - |
| ② | アイデア出し | 未 | challenge/idea.md |
| ③ | 試作検討 | 未 | challenge/prototype_check.md |
| ④ | 壁打ち | 未 | challenge/requirements.md |
| ⑤ | アプリ作成 | 未 | app/index.html（GAS の場合 gas-app/Code.gs） |
| ⑥ | デプロイ | 未 | challenge/deploy.md |
| ⑦ | 動画の台本 | 未 | challenge/video_script.md |
| ⑧ | 動画の作成 | 未 | challenge/demo.webm |
| ⑨ | 応募文 | 未 | challenge/entry_form.md / entry_form.json |
| ⑩ | フォームに入力 | 未 | -（送信は本人） |
| ⑪ | LT スライド | 未 | challenge/lt/lt.html |

## メモ
（他のスキルが書き足す）
```

## 気をつけること

- 他のスキルを自分で実行しない。勧めるだけ。参加者が「やって」と言ったら、そのスキルの名前（例: `/ai-challenge-kit:idea-spark`）を入力するよう案内する。
- 専門用語（デプロイ、GAS、API キーなど）を使うときは一言で説明する。
- ログイン・課金・規約への同意・フォームの送信は本人が行う。このスキルも他のスキルも代行しない。
- 応募条件を聞かれて `references/rules_summary.md` に無いことは、推測で答えず公式ページ https://googlejp25.withgoogle.com/awards/ を案内する。
- 完成度は審査で問われない。「動画で見せられる最小の形」でよいと伝え、作り込みすぎを止める。
