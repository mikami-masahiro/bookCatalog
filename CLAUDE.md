# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## マルチプロジェクト構成

このリポジトリは 2 つの独立した npm プロジェクトで構成される（ルートに
workspaces は設けず、各フォルダで個別に `npm install` する）。

```
project_book_catalog/
  server/   … 書籍・雑誌の新刊情報 Web API サーバー（Hono + node:sqlite）
  client/   … React SPA クライアント（ブラウザ + Electron）
```

- **server/** … API 本体。詳細は [server/CLAUDE.md](server/CLAUDE.md)。
- **client/** … API を呼び出す UI。詳細は [client/CLAUDE.md](client/CLAUDE.md)。

## API 契約（サーバー ↔ クライアント）

TypeScript の型はプロジェクト間で共有しない。代わりに **`server/openapi.json`**
を唯一の契約とする（`@hono/zod-openapi` から生成）。

- サーバーで API を変更したら `cd server && npm run openapi` で再生成しコミット。
- クライアントは `cd client && npm run gen:api` で `openapi.json` から型を生成する。

## 開発フロー（概要）

```bash
# 1) API サーバー（:3000）
cd server && npm install && npm run dev

# 2) 別ターミナルでクライアント（:5173、/api を :3000 にプロキシ）
cd client && npm install && npm run dev        # ブラウザ
cd client && npm run electron:dev              # Electron（サーバー起動が前提）
```

## 共通の規約

- インデントは **タブ・表示幅 4**（リポジトリ直下の [.editorconfig](.editorconfig) で
  両プロジェクトに適用）。
- 日付・日時は **UNIX time（秒）の整数**（API 入出力・DB 列・クライアント共通）。
- import の `.js` 拡張子規約は **server のみ**（NodeNext）。client はブラウザ向けで
  付けない（詳細は各 CLAUDE.md）。
