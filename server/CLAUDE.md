# CLAUDE.md（server）

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

このリポジトリは **マルチプロジェクト構成** で、`server/`（このプロジェクト）と
`client/`（React SPA。ブラウザ + Electron）が共存する。全体像はリポジトリ直下の
[../CLAUDE.md](../CLAUDE.md) を参照。サーバーとクライアントの API 契約は
**`server/openapi.json`**（`@hono/zod-openapi` から生成）が正本。

## プロジェクト概要

日本国内で出版される書籍・雑誌の**新刊情報**を扱う Web API サーバー。
Node.js + TypeScript + Hono、DB はローカルの SQLite（Node.js 標準 `node:sqlite`）。
API 定義は `@hono/zod-openapi` で記述し、OpenAPI 仕様を配信・出力する。

## よく使うコマンド

```bash
npm run dev          # 開発サーバー（tsx watch、ホットリロード）
npm run build        # tsc で dist/ へコンパイル
npm start            # dist/index.js を起動（要 build）
npm run typecheck    # tsc --noEmit（型チェックのみ）
npm test             # 全テスト（tsx --test）
npm run seed         # サンプルデータ投入
npm run openapi      # openapi.json を生成（API 変更後は実行してコミット）
```

OpenAPI 仕様の確認: 開発サーバー起動中に `http://localhost:3000/openapi.json`
（生 JSON）、`http://localhost:3000/docs`（Swagger UI）。

単体テストの実行（特定ファイル / 特定ケース）:

```bash
npx tsx --test test/books.test.ts            # ファイル単位
npx tsx --test --test-name-pattern="409" test/books.test.ts  # 名前で絞り込み
```

## アーキテクチャ

レイヤーを分離し、**DB 接続を引数で注入する**設計。これによりテストでは
インメモリ DB（`:memory:`）を使って各テストを完全に独立させられる。

依存の流れ（上が下に依存）:

```
src/index.ts        … 起動のみ。@hono/node-server で serve
  └─ src/app.ts     … createApp(db) で OpenAPIHono を組み立て、CORS / ルート /
  │                    /openapi.json / /docs を束ねる
       └─ src/routes/books.ts        … HTTP 層。createRoute で API を定義し repo / service を呼ぶ
            ├─ src/repositories/bookRepository.ts … SQL 層。books テーブル CRUD
            │    └─ src/db/index.ts  … createDatabase(path)：接続+PRAGMA+スキーマ初期化
            │         └─ src/db/schema.sql … CREATE TABLE / INDEX（冪等。文字列として読み込む）
            └─ src/services/openbd.ts … 外部 API（OpenBD）連携。DB には触れない

scripts/gen-openapi.ts … createApp の OpenAPI ドキュメントを openapi.json へ書き出す
```

外部 API 連携など DB 以外の I/O は `src/services/` に置く（`openbd.ts` が例）。
`GET /api/books/openbd/:isbn` は OpenBD から取得して `Book` 形状で返すだけで
**保存はしない**（`id` は 0、時刻は取得時刻）。通信・応答エラーは `OpenBdError`
にまとめ、ルート層で 502 に写像する。純粋な変換ロジック（`mapRecordToBook` 等）は
export してネットワーク無しでテストする（`test/openbd.test.ts`）。

横断的な定義:

- `src/types.ts` … DB レコードに対応する `Book` 型・`Category` 型。
- **API 定義（zod + OpenAPI）はルート層に同居**：`routes/books.ts` 内で
  `bookInputSchema` /  `listQuerySchema` /  レスポンス用 `bookSchema` ほかを
  `@hono/zod-openapi` の `z` で定義し、`createRoute` で各エンドポイントを宣言する
  （ルートでしか使わないため非 export）。`bookSchema` は `src/types.ts` の `Book`
  と一致させること（ズレると OpenAPI/クライアント型と実体が食い違う）。
- リポジトリは **自前の入力型**（`BookWriteInput` / `BookListQuery`、
  `bookRepository.ts` で定義・export）を受け取る。zod には依存しない。

### 重要な約束ごと

- **ESM + NodeNext**：プロジェクト内 import は必ず `.js` 拡張子を付ける
  （例：`import { createApp } from "./app.js"`）。TS ソースでも `.js`。
- **DB は注入する**：新しいリポジトリやルートを足すときも `createApp(db)` /
  `new XxxRepository(db)` の形を保ち、モジュールトップで `db` を直接掴まない
  （`src/index.ts` と `src/seed.ts` だけが既定接続 `src/db/index.ts` の `db` を使う）。
- **`node:sqlite` の戻り値の型**：`.get()` / `.all()` は
  `Record<string, SQLOutputValue>` を返すため、行を `Book` として扱うには
  `as unknown as Book` の二段キャストが必要（既存コードに倣う）。
- **バリデーションはルート層・詰め替えもルート層**：`routes/books.ts` で
  `createRoute` の `request`（params / query / json）にスキーマを与えて検証し、
  検証済みの値を `c.req.valid(...)` で取り出す。それを `toWriteInput` / `toListQuery`
  でリポジトリ入力（`BookWriteInput` / `BookListQuery`）に詰め替えてから渡す。
  `?? null` などの正規化はこの詰め替えで行い、リポジトリ側ではしない。これにより
  Web 入力の形と永続化層の契約を独立させる。HTTP を経由しない `seed.ts` は
  `BookWriteInput` を直接組み立てる。
- **検証エラーの形**：`OpenAPIHono` の `defaultHook` で検証失敗を `{ error }` 形
  （400）に統一している。他のエラー応答も `{ error: string }`（`errorSchema`）で揃える。
- **エラーの扱い**：ISBN の UNIQUE 制約違反はルート層で 409 に変換している
  （`isUniqueViolation`）。新しい制約を足したら同様に HTTP ステータスへ写像し、
  `createRoute` の `responses` にも追記する。
- **OpenAPI を正本に保つ**：エンドポイントやスキーマを変更したら `npm run openapi`
  で `openapi.json` を再生成してコミットする。クライアントはこれを入力に型生成する。

### データモデル

`books` テーブル 1 つ。`category` は `'book' | 'magazine'`、`isbn` は UNIQUE で
雑誌など無い場合は NULL 可。**日付・日時はすべて UNIX time（秒）の INTEGER**
（`release_date` / `created_at` / `updated_at`）。`created_at` / `updated_at` は
`DEFAULT (unixepoch())` で自動設定し、更新時は `update` が `unixepoch()` で上書きする。
スキーマ変更は `src/db/schema.sql` を編集する（マイグレーション機構は未導入。
`CREATE TABLE IF NOT EXISTS` のため、列定義を変えた場合は既存の `data/app.db`
を削除しないと反映されない。本番データがある場合は別途移行手順が必要）。

## コーディング規約

### インデント

- **タブで統一**。スペースインデントは使わない。
- 表示幅は **4**（[.editorconfig](.editorconfig) と [.vscode/settings.json](.vscode/settings.json) で
  `tab_width` / `tabSize` = 4、`insertSpaces = false` を強制）。
- 例外：テンプレートリテラル内の SQL（`src/db/schema.sql` /
  `src/repositories/bookRepository.ts`）は **文字列の中身** なのでスペースのまま。
  ここをタブ化すると文字列内容そのものが変わるため触らない。

### SQL

- `INSERT` / `UPDATE` / `SELECT` / `DELETE` 文はできる限り **1 行で書く**
  （テンプレートリテラルでも改行で整形しない）。`CREATE TABLE` などの DDL
  （`src/db/schema.sql`）は対象外で、複数行のままで良い。

### 日付・日時

- すべて **UNIX time（秒）の整数** で扱う。`YYYY-MM-DD` などの文字列や
  ミリ秒は使わない（API の入出力・DB 列ともに秒の整数）。
- DB のデフォルトと現在時刻取得は SQLite の `unixepoch()`（秒）を使う。
  `datetime('now')` など文字列を返す関数は使わない。
- アプリ側で現在時刻が要るときは `Math.floor(Date.now() / 1000)`。

### コメント

- **コードから読み取れることはコメントにしない**。型名・関数名・SQL で
  自明な「何をしているか」の説明は書かない（あれば削除する）。
- 残すのは **コードから読み取れない情報だけ**：ドメイン知識、フォーマット、
  単位、意図的な仕様（例：部分更新ではなく全置き換え）、回避策の理由など。
- 形式は **`//` を優先**。`/** */`（JSDoc）は使わない。
- 既存例：`isbn` が雑誌で null になる理由、`price` の単位、`release_date` の
  `YYYY-MM-DD` 形式、`node:sqlite` の戻り値型による二段キャストの理由 など。

## 設定（環境変数）

- `PORT` … リッスンポート（既定 3000）
- `DATABASE_PATH` … SQLite ファイルパス（既定 `data/app.db`、`:memory:` 可）
- `CORS_ORIGINS` … CORS で許可するオリジン（カンマ区切り。既定
  `http://localhost:5173`）。Electron の `file://` など Origin 無しは常に許可する。