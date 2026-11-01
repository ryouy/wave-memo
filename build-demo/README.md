# Appetize 用のビルド

公開中のデモ: https://appetize.io/app/b_yhllib3pg5o26rqxy2z4rlibdm

`WaveMemo-simulator.zip` は、iOS シミュレーター向けの Release ビルド（`WaveMemo.app` を zip にしたもの）です。

- 対応: iOS 17 以降 / iPhone・iPad / Intel と Apple Silicon の両方（x86_64 + arm64）
- Bundle ID: `com.ryouy.wavememo`
- 署名は不要です（シミュレーター用なので、実機には入りません）

## Appetize にあげる

1. https://appetize.io/upload を開く
2. Platform に **iOS** を選ぶ
3. `WaveMemo-simulator.zip` をアップロードする（zip のまま。展開しない）
4. 発行された公開リンクを共有する

## 作り直す

コードを変えたら、次で zip を作り直せます。

```bash
./build-demo/build.sh
```

`WaveMemo-simulator.zip` は容量が大きいので、git には入れていません（`.gitignore` 済み）。上のスクリプトでいつでも作れます。
