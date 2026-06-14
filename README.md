# Book Catalog Web Service

日本国内で出版される書籍・雑誌の新刊情報を扱う Web API サーバーです。

## 技術スタック

- **Node.js**（>= 22.5.0） / **TypeScript**
- **Hono**（Web フレームワーク）+ `@hono/node-server`
- **SQLite**（Node.js 標準の `node:sqlite` を使用。ローカルファイル DB）
- **zod**（入力バリデーション）

## セットアップ

```bash
npm install
```

## 実行

```bash
npm run dev      # 開発サーバー（ファイル変更を監視して再起動）
npm run build    # TypeScript を dist/ にコンパイル
npm start        # ビルド済みの dist/index.js を起動
npm run seed     # サンプル新刊データを投入
npm test         # テスト実行
npm run typecheck# 型チェックのみ
```

既定では `http://localhost:3000` で起動します。`PORT` 環境変数で変更できます。
DB ファイルは既定で `data/app.db`。`DATABASE_PATH` 環境変数で変更できます。

## API

ベースパス: `/api/books`

| メソッド | パス               | 説明                               |
| -------- | ------------------ | ---------------------------------- |
| GET      | `/health`          | ヘルスチェック                     |
| GET      | `/api/books`       | 一覧（絞り込み・検索・ページング） |
| GET      | `/api/books/:id`   | 1 件取得                           |
| GET      | `/api/books/openbd/:isbn` | OpenBD から取得（DB 未保存） |
| POST     | `/api/books/create` | 新規登録                          |
| POST     | `/api/books/update/:id` | 更新（全項目置き換え）        |
| POST     | `/api/books/delete/:id` | 削除                         |

### 一覧のクエリパラメータ

- `category` … `book` / `magazine`
- `publisher` … 出版社名（完全一致）
- `q` … タイトル・著者名の部分一致検索
- `from` / `to` … 発売日の範囲（UNIX time 秒の整数、両端含む）
- `limit`（既定 20、最大 100） / `offset`（既定 0）

> 日付・日時はすべて **UNIX time（秒）の整数** で扱います（`release_date` /
> `created_at` / `updated_at`）。`created_at` / `updated_at` はサーバー側で自動設定されます。

### OpenBD 連携

`GET /api/books/openbd/:isbn` は [OpenBD](https://openbd.jp/) から書籍情報を取得し、
books テーブルと同一形状（`Book`）の JSON で返します。**DB には保存しません**
（`id` は 0、`created_at` / `updated_at` は取得時刻）。該当が無ければ 404、
OpenBD 側の通信・応答エラーは 502 を返します。

```bash
curl http://localhost:3000/api/books/openbd/9784873119045
```

参照した OpenBD の仕様:

- OpenBD 公式: <https://openbd.jp/>
- API 仕様: <https://openbd.jp/spec/>
- 取得エンドポイント: <https://api.openbd.jp/v1/get?isbn=9784873119045>

### リクエスト例

```bash
curl -X POST http://localhost:3000/api/books/create \
  -H "content-type: application/json" \
  -d '{
    "isbn": "9784101010014",
    "title": "こころ",
    "author": "夏目 漱石",
    "publisher": "新潮社",
    "category": "book",
    "price": 539,
    "release_date": 1748736000
  }'
```