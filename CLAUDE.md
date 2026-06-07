# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

日本国内で出版される書籍・雑誌の**新刊情報**を扱う Web API サーバー。
Node.js + TypeScript + Hono、DB はローカルの SQLite（Node.js 標準 `node:sqlite`）。

## よく使うコマンド

```bash
npm run dev          # 開発サーバー（tsx watch、ホットリロード）
npm run build        # tsc で dist/ へコンパイル
npm start            # dist/index.js を起動（要 build）
npm run typecheck    # tsc --noEmit（型チェックのみ）
npm test             # 全テスト（tsx --test）
npm run seed         # サンプルデータ投入
```

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
  └─ src/app.ts     … createApp(db) で Hono アプリを組み立て、ルートを束ねる
       └─ src/routes/books.ts        … HTTP 層。zValidator で検証し repo を呼ぶ
            └─ src/repositories/bookRepository.ts … SQL 層。books テーブル CRUD
                 └─ src/db/index.ts  … createDatabase(path)：接続+PRAGMA+スキーマ初期化
                      └─ src/db/schema.ts … CREATE TABLE / INDEX（冪等）
```

横断的な定義:

- `src/schemas.ts` … zod スキーマと、そこから導出する入力型
  （`BookInput` / `ListQuery`）。ルートとリポジトリの両方がここを参照する。
- `src/types.ts` … DB レコードに対応する `Book` 型・`Category` 型。

### 重要な約束ごと

- **ESM + NodeNext**：プロジェクト内 import は必ず `.js` 拡張子を付ける
  （例：`import { createApp } from "./app.js"`）。TS ソースでも `.js`。
- **DB は注入する**：新しいリポジトリやルートを足すときも `createApp(db)` /
  `new XxxRepository(db)` の形を保ち、モジュールトップで `db` を直接掴まない
  （`src/index.ts` と `src/seed.ts` だけが既定接続 `src/db/index.ts` の `db` を使う）。
- **`node:sqlite` の戻り値の型**：`.get()` / `.all()` は
  `Record<string, SQLOutputValue>` を返すため、行を `Book` として扱うには
  `as unknown as Book` の二段キャストが必要（既存コードに倣う）。
- **バリデーションはルート層**：リクエスト検証は `zValidator` で行い、
  リポジトリは検証済みの `BookInput` / `ListQuery` を受け取る前提。
- **エラーの扱い**：ISBN の UNIQUE 制約違反はルート層で 409 に変換している
  （`isUniqueViolation`）。新しい制約を足したら同様に HTTP ステータスへ写像する。

### データモデル

`books` テーブル 1 つ。`category` は `'book' | 'magazine'`、`isbn` は UNIQUE で
雑誌など無い場合は NULL 可。**日付・日時はすべて UNIX time（秒）の INTEGER**
（`release_date` / `created_at` / `updated_at`）。`created_at` / `updated_at` は
`DEFAULT (unixepoch())` で自動設定し、更新時は `update` が `unixepoch()` で上書きする。
スキーマ変更は `src/db/schema.ts` を編集する（マイグレーション機構は未導入。
`CREATE TABLE IF NOT EXISTS` のため、列定義を変えた場合は既存の `data/app.db`
を削除しないと反映されない。本番データがある場合は別途移行手順が必要）。

## コーディング規約

### インデント

- **タブで統一**。スペースインデントは使わない。
- 表示幅は **4**（[.editorconfig](.editorconfig) と [.vscode/settings.json](.vscode/settings.json) で
  `tab_width` / `tabSize` = 4、`insertSpaces = false` を強制）。
- 例外：テンプレートリテラル内の SQL（`src/db/schema.ts` /
  `src/repositories/bookRepository.ts`）は **文字列の中身** なのでスペースのまま。
  ここをタブ化すると文字列内容そのものが変わるため触らない。

### SQL

- `INSERT` / `UPDATE` / `SELECT` / `DELETE` 文はできる限り **1 行で書く**
  （テンプレートリテラルでも改行で整形しない）。`CREATE TABLE` などの DDL
  （`src/db/schema.ts`）は対象外で、複数行のままで良い。

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