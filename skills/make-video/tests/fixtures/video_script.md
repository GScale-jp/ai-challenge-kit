# 90秒デモ動画の台本

## 0〜15秒　困りごと

- 画面: 家族で備えを確認する場面を字幕で見せます。
- ナレーション: そろえたものを家族で何度も確認していました。

## 15〜70秒　Google の AI を使っている画面

- 画面: リストに保存水を追加する練習用アプリを操作します。
- ナレーション: テスト用の画面です。追加ボタンから項目を入れます。

## 70〜90秒　誰がどう助かるか・ほかにも広がること

- 画面: リストで備えが見えることを字幕で伝えます。
- ナレーション: 家族で、何が残っているか確認できます。

## 自動作成用の場面データ

```json
{
  "appUrl": "skills/make-video/tests/fixtures/dummy_app/index.html",
  "intro": { "title": "備えのリスト", "caption": "練習用のアプリです", "seconds": 3 },
  "scenes": [
    { "id": "problem", "title": "確認を何度も繰り返します", "caption": "用意できたものが見えません", "seconds": 4 },
    { "id": "demo", "title": "備えをリストに追加します", "caption": "保存水を追加します", "seconds": 9,
      "steps": [
        { "action": "click", "selector": "#add" },
        { "action": "fill", "selector": "#name", "text": "保存水" },
        { "action": "press", "key": "Enter" },
        { "action": "wait", "ms": 800 },
        { "action": "click", "selector": "#items li" }
      ]
    },
    { "id": "wrapup", "title": "家族で備えを確認できます", "caption": "リストを見れば次に用意するものが分かります", "seconds": 4 }
  ],
  "antigravityClip": null
}
```
