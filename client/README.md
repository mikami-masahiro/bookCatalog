# Book Catalog Client

書籍・雑誌の新刊情報 API（`../server`）を呼び出す React SPA。
**ブラウザと Electron の両方** で動作します。

## 技術スタック

- **React** + **Vite** + **TypeScript**
- **openapi-fetch** / **openapi-typescript**（`../server/openapi.json` から型を生成）
- **Electron**（`vite-plugin-electron` + `electron-builder`）

## セットアップ

```bash
npm install
npm run gen:api      # ../server/openapi.json から型を生成（src/api/schema.d.ts）
```

API サーバーを先に起動しておきます（別ターミナル）:

```bash
cd ../server && npm run dev      # http://localhost:3000
```

## 実行

```bash
npm run dev            # ブラウザ開発（http://localhost:5173、/api を :3000 にプロキシ）
npm run build          # ブラウザ向け本番ビルド（dist/）
npm run electron:dev   # Electron で開発起動（サーバー起動が前提）
npm run electron:build # Electron アプリをパッケージ（release/）
```

## API ベース URL の指定

| 環境             | 解決方法                                                       |
| ---------------- | -------------------------------------------------------------- |
| ブラウザ開発     | `""`（Vite プロキシで `/api` を `:3000` へ。CORS 不要）         |
| ブラウザ本番     | ビルド時の環境変数 `VITE_API_BASE_URL`                         |
| Electron         | main プロセスの `API_BASE_URL`（既定 `http://localhost:3000`） |

Electron はサーバーを同梱せず、別プロセスのサーバーへ接続します（リモート URL 方式）。
そのためサーバー側で CORS の許可が必要です（`server` の `CORS_ORIGINS` を参照）。
