# Wave Memo

> **Text should not always remain.**
> 言葉は、波に消える。

書いた言葉を、波がさらっていくメモです。保存はされません。

波打ち際に言葉を書くと、ときどき大きな波が砂浜まで下りてきて、上の行から消していきます。
残したい言葉は、スクリーンショットで、自分の意思で残します。

**[ブラウザで試す](https://wave-memo-vlgs.vercel.app/)**

**[iOS のシミュレーターで試す（Appetize）](https://appetize.io/app/b_yhllib3pg5o26rqxy2z4rlibdm)**

## できること

- 書いた言葉は、波にさらわれて消える（保存・履歴・元に戻す機能はありません）
- 「言葉を海へ」で、言葉を水平線のほうへ飛ばして、入力欄をきれいにする
- 朝・昼・夕・晩の景色。切り替えると、太陽が沈んで月が昇る
- イラストのセットを4種類から選べる（ヴィンテージ / カラフル / 絵画風 / 輪郭つきポップ）
- ガイド、全画面（ウェブ版のみ）、スマホのキーボードに合わせた表示

## 開発

### ウェブ版（Next.js）

```bash
npm install
npm run dev     # http://localhost:3000
```

### iOS 版（SwiftUI）

`ios/WaveMemo.xcodeproj` を Xcode 16 以降で開いて、iPhone / iPad（iOS 17 以降）で実行します。
実機で動かすときは、Signing & Capabilities で自分の Team を選んでください。

## 構成

| 場所 | 内容 |
| --- | --- |
| `app/` | ウェブ版（景色は p5 のキャンバス、入力欄は React） |
| `ios/` | iOS 版（景色は SwiftUI の Canvas、入力欄は UITextView） |
| `public/art/` | イラストのセット（`classic` `pop` `painted` `cartoon`） |
| `design/` | スプラッシュ画像の生成スクリプト |

イラストを差し替えるときは、`public/art/<セット名>/` と `ios/WaveMemo/Assets.xcassets/<セット名>-*.imageset` の両方を更新します。

## 作りについて

データベースはなく、何も保存しません。入力した言葉は端末の外へ送られません。
