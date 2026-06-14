# Book Catalog

日本国内で出版される書籍・雑誌の新刊情報を扱う Web サービス。
**API サーバー** と、それを呼び出す **React SPA クライアント**（ブラウザ + Electron）の
マルチプロジェクト構成です。

```
project_book_catalog/
  server/   … Web API サーバー（Node.js + TypeScript + Hono + SQLite）
  client/   … React SPA（Vite + React、ブラウザ / Electron 両対応）
```

## 構成プロジェクト

- **[server/](server/)** … 新刊情報の REST API。詳細は [server/README.md](server/README.md)。
- **[client/](client/)** … API を呼び出すクライアント。詳細は [client/README.md](client/README.md)。

## API 契約

サーバーとクライアントの間は **`server/openapi.json`**（OpenAPI 仕様）で型を共有します。
サーバーは `@hono/zod-openapi` で仕様を生成・配信し、クライアントはそこから型を生成します。

## クイックスタート

```bash
# API サーバー（http://localhost:3000）
cd server
npm install
npm run dev

# クライアント（http://localhost:5173、別ターミナル）
cd client
npm install
npm run gen:api      # openapi.json から型生成
npm run dev          # ブラウザ
# または
npm run electron:dev # Electron（サーバー起動が前提）
```
