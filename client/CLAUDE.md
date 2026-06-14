# CLAUDE.md（client）

This file provides guidance to Claude Code (claude.ai/code) when working with code in this client project.

書籍・雑誌の新刊情報 API を呼び出す **React SPA クライアント**。同じコードを
**ブラウザと Electron の両方** で動かす。サーバー本体は `../server`、全体像は
リポジトリ直下の [../CLAUDE.md](../CLAUDE.md) を参照。

## よく使うコマンド

```bash
npm run dev          # Vite 開発サーバー（:5173、/api を :3000 にプロキシ）
npm run gen:api      # ../server/openapi.json から src/api/schema.d.ts を生成
npm run typecheck    # tsc --noEmit（renderer + node の 2 構成）
npm run build        # 型チェック + ブラウザ向け SPA を dist/ へ
npm run electron:dev # Electron で起動（要: サーバー起動）
npm run electron:build # Electron アプリをパッケージ（electron-builder）
```

前提: API サーバーを別途起動しておく（`cd ../server && npm run dev`）。

## アーキテクチャ

```
src/main.tsx        … React エントリ（createRoot）
src/App.tsx         … 最小 UI（/health 疎通 + 一覧表示）
src/api/
  config.ts         … API ベース URL を実行環境ごとに解決
  client.ts         … openapi-fetch による型付きクライアント（api.list 等）
  schema.d.ts       … openapi.json からの生成物（手で編集しない）
electron/
  main.ts           … main プロセス。BrowserWindow を作りレンダラを読み込む
  preload.ts        … contextBridge で API ベース URL（文字列）だけを公開
```

## 重要な約束ごと

- **API 契約は `../server/openapi.json`**。サーバーで API を変えたら、サーバー側で
  `npm run openapi` → こちらで `npm run gen:api` を実行して `schema.d.ts` を更新する。
  型は手書きせず、`components["schemas"][...]` から導出する（`client.ts` 参照）。
- **API ベース URL の解決**（`src/api/config.ts`）:
  - ブラウザ開発: `""`（同一オリジン → Vite プロキシ → :3000、CORS 不要）
  - ブラウザ本番: `VITE_API_BASE_URL`（ビルド時）
  - Electron: preload が注入する `window.__API_BASE_URL__`
- **Electron は「リモート URL + CORS」方式**。サーバーは同梱せず別プロセスで起動し、
  レンダラは `http://localhost:3000`（既定）を叩く。サーバー側 CORS の許可が必要。
  main プロセスの `API_BASE_URL` 環境変数で接続先を変更できる。
- **`.js` 拡張子は付けない**。このプロジェクトは Vite/esbuild の Bundler 解決で動くため、
  相対 import に拡張子は書かない（`./App`）。`.js` を付けるサーバー側の NodeNext 規約は
  **ここには適用しない**。
- **TS は 2 構成に分ける**: `tsconfig.json`（renderer / DOM）と
  `tsconfig.node.json`（`vite.config.ts` と `electron/` / Node）。レンダラに Node 型、
  main/preload に DOM 型を混ぜない。
- **preload で公開するのは文字列のみ**（`contextIsolation: true`,
  `nodeIntegration: false`）。Node API をレンダラへ渡さない。
- **vite-plugin-electron は `TARGET=electron` のときだけ有効化**（`vite.config.ts`）。
  通常の `vite build` はブラウザ SPA のみを出力する。Electron ビルドは `base: "./"`
  で `file://` からアセットを解決する。

## コーディング規約

- インデントは **タブ・表示幅 4**（リポジトリ直下の `.editorconfig`）。
- 日付・日時は **UNIX time（秒）の整数**。表示時のみ整形する（`Date` へ変換して送らない）。
- コメントはコードから読み取れないことだけ。形式は `//` を優先。
