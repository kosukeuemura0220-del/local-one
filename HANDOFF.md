# Local ONE 引き継ぎメモ

最終更新: 2026-06-26

## 概要

Local ONE は、Mac / Windows / iPhone / Android 間でローカル優先にファイル、フォルダ、動画、画像、GIF、`.env`、テキスト、キー情報を送受信するためのアプリです。

現在の実装は次の構成です。

- Mac / Windows: Electron デスクトップアプリ想定
- iPhone / Android: ブラウザ / PWA で接続
- フロントエンド: React + Vite
- ローカルサーバー: Node.js + Express + WebSocket
- 大容量転送: 8 MiB チャンク分割
- ペアリング: QRコード、ペアリングリンク、6桁コード

## 現在の配置予定

このプロジェクトはデスクトップに配置されています。

```text
/Users/kuemura/Desktop/Local ONE
```

作業するときはこのフォルダを開いてください。

## 起動方法

開発起動:

```bash
cd "/Users/kuemura/Desktop/Local ONE"
npm install
npm run dev
```

固定ポートで起動したい場合:

```bash
npx concurrently -k "node server/index.js --dev" "npx vite --host 0.0.0.0 --port 5174"
```

主なURL:

```text
Mac上のブラウザ: http://localhost:5174/
LAN内のWindows/スマホ: http://<MacのLAN IP>:5174/
APIサーバー: http://127.0.0.1:47110
```

直近のMac LAN URLは次でした。

```text
http://192.168.0.51:5174/
```

IPはネットワークにより変わるので、画面上のLAN URLを優先してください。

## ペアリング手順

スマホの場合:

1. MacまたはWindowsでLocal ONEを開く
2. 右側の「デバイスをペアリング」を押す
3. iPhone / Android のカメラでQRコードを読み取る
4. 表示された画面でペアリングする

カメラのないWindowsなどの場合:

1. MacまたはWindowsでLocal ONEを開く
2. 右側の「デバイスをペアリング」を押す
3. QR下に出る6桁コードを確認する
4. 接続したい端末でLAN URLを開く
5. 「ペアリングが必要です」画面に6桁コードを入力する
6. 「コードでペアリング」を押す

## Mistyフォルダを送る手順

Mistyのようなプロジェクトフォルダは、通常のファイル選択では送れません。送信パネルの「フォルダを選択」を使ってください。

1. 右側の送信パネルで「ファイル」タブを開く
2. 「フォルダを選択」を押す
3. `Misty` フォルダを選ぶ
4. 選択数と容量が出たら「送信」を押す

ドラッグ&ドロップでもフォルダ内を再帰的に読み取る実装になっています。

注意:

- `node_modules` が入っているプロジェクトフォルダはかなり重くなります。
- 送れますが、ファイル数と容量が増えるため時間がかかります。
- 必要に応じて `node_modules`、`.next`、`.expo` などを除いたzipを作って送る方が速いです。

## 実装済みの主な機能

- Mac / Windows デスクトップアプリ用Electron構成
- iPhone / Android ブラウザ / PWA接続
- 同一LAN内のデバイス接続
- QRペアリング
- 6桁コードペアリング
- 信頼済みセッション保存
- ファイル転送
- フォルダ転送
- フォルダ相対パス保持
- フォルダドラッグ&ドロップの再帰読み取り
- テキスト転送
- 秘密モード
- 秘密テキストのメモリ保持とTTL
- チャンクアップロード
- SHA-256検証
- 受信フォルダへの保存
- mDNSによる近くのLocal ONE検出

## 重要なファイル

```text
package.json
README.md
HANDOFF.md
server/index.js
server/lib/store.js
server/lib/security.js
server/lib/network.js
src/App.tsx
src/components/SendPanel.tsx
src/components/PairingGate.tsx
src/components/TransferQueue.tsx
src/components/DeviceRail.tsx
src/lib/upload.ts
src/lib/api.ts
src/styles.css
electron/main.cjs
electron/preload.cjs
```

## 最近入れた重要変更

### 6桁コードペアリング

カメラのないWindowsでも使えるように、QRだけでなく6桁コードでペアリングできるようにしました。

関係ファイル:

```text
server/lib/store.js
server/index.js
src/components/PairingGate.tsx
src/components/SendPanel.tsx
src/lib/api.ts
```

### QR手順とコード手順の両表示

スマホのQR接続手順が消えないよう、画面上にQR接続と6桁コード接続の両方を表示しています。

関係ファイル:

```text
src/components/PairingGate.tsx
src/components/SendPanel.tsx
README.md
```

### Mistyなどのフォルダ送信

「ファイルを選択」と「フォルダを選択」を分離しました。フォルダ選択inputには `webkitdirectory` を付けています。

関係ファイル:

```text
src/components/SendPanel.tsx
src/lib/upload.ts
src/styles.css
```

## 検証済みコマンド

```bash
npm run build
npm test
LOCAL_ONE_WEB_URL=http://127.0.0.1:5174/ npm run qa:browser
```

直近では以下を確認済みです。

- ビルド成功
- サーバーテスト9件成功
- 画面QA成功
- 6桁コードでペアリング成功
- 小さい検証用フォルダを実際に送信成功
- フォルダ内相対パス保持を確認

検証用フォルダ送信で確認した相対パス例:

```text
Misty-mini/README.md
Misty-mini/src/index.ts
```

## 配布ビルド

Mac版:

```bash
npm run dist:mac
```

Windows版:

```bash
npm run dist:win
```

成果物は `release/` に出ます。

公開配布する場合:

- MacはApple Developer ID署名とnotarizationが必要
- Windowsはコード署名証明書があると警告を減らせる
- 未署名でも配布はできるが、OSの警告が出やすい

## ネットワーク注意点

Local ONEはローカルネットワーク前提です。

- MacがWi-Fi、Windowsが有線でも、同じルーター配下なら接続できます。
- 別ネットワークの場合は `192.168.x.x` のURLでは開けません。
- ゲストWi-Fi、ルーターの端末分離、OSファイアウォールで通信が止まることがあります。
- APIポートは `47110`、画面ポートは開発時 `5174` です。

別ネットワーク対応をしたい場合は、将来的にTailscale / ZeroTier対応、または中継サーバー方式を検討してください。

## セキュリティ注意点

- インターネット公開用ファイルサーバーではありません。
- `47110` を公開インターネットに出さないでください。
- QR / 6桁コードは信頼できる端末だけに使ってください。
- `.env` や秘密ファイルは送信後、必要に応じて転送履歴を削除してください。
- 秘密テキストは履歴でマスクされ、TTL後に期限切れになります。

## 今後のおすすめ

1. HP用のダウンロードページを作る
2. Mac / Windowsの署名付き配布を整える
3. iPhone / AndroidはPWA案内を整える
4. 可能ならTailscale / ZeroTier連携を追加する
5. フォルダ送信時に `node_modules` などを除外できる設定を追加する
6. 大容量送信の一時停止/再開UIを強化する

## よくある詰まり

### Windowsで「ペアリングが必要」と出る

正常です。Mac側で「デバイスをペアリング」を押し、QRまたは6桁コードでペアリングしてください。

### カメラがないWindowsでQRが読めない

Mac側のQR下に表示される6桁コードをWindows側のロック画面に入力してください。

### Mistyフォルダを選んでも「開く」が押せない

通常のファイル選択を使っています。右側の「フォルダを選択」を押してからMistyフォルダを選んでください。

### Windowsが開けない

MacとWindowsが同じLANにいるか確認してください。MacがWi-Fi、Windowsが有線でも同じルーターなら使えます。

