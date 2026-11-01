#!/bin/bash
# Appetize 用に、iOS シミュレーター向けの Release ビルドを作って zip にまとめる。
# 使い方: ./build-demo/build.sh   （Xcode 16 以降が必要）
set -euo pipefail
cd "$(dirname "$0")/.."

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
DD="$(mktemp -d)"

xcodebuild -project ios/WaveMemo.xcodeproj -scheme WaveMemo \
  -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DD" ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO CODE_SIGNING_ALLOWED=NO build

rm -f build-demo/WaveMemo-simulator.zip
(cd "$DD/Build/Products/Release-iphonesimulator" && zip -r -y -X -q "$OLDPWD/build-demo/WaveMemo-simulator.zip" WaveMemo.app)
rm -rf "$DD"
echo "できました: build-demo/WaveMemo-simulator.zip"
