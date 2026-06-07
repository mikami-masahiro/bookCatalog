import type { DatabaseSync } from "node:sqlite";
import type { Book } from "../types.js";
import type { BookInput, ListQuery } from "../schemas.js";

export interface ListResult {
  items: Book[];
  total: number;
}

/**
 * books テーブルへのアクセスを集約するリポジトリ。
 * DB 接続を注入する形にしているため、テストではインメモリ DB を渡せる。
 */
export class BookRepository {
  constructor(private readonly db: DatabaseSync) {}

  /** 条件で絞り込み、発売日の新しい順に一覧取得する */
  list(query: ListQuery): ListResult {
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (query.category) {
      where.push("category = ?");
      params.push(query.category);
    }
    if (query.publisher) {
      where.push("publisher = ?");
      params.push(query.publisher);
    }
    if (query.from) {
      where.push("release_date >= ?");
      params.push(query.from);
    }
    if (query.to) {
      where.push("release_date <= ?");
      params.push(query.to);
    }
    if (query.q) {
      where.push("(title LIKE ? OR author LIKE ?)");
      const like = `%${query.q}%`;
      params.push(like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRow = this.db
      .prepare(`SELECT COUNT(*) AS c FROM books ${whereSql}`)
      .get(...params) as { c: number };

    const items = this.db
      .prepare(
        `SELECT * FROM books ${whereSql}
         ORDER BY release_date DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, query.limit, query.offset) as unknown as Book[];

    return { items, total: countRow.c };
  }

  findById(id: number): Book | undefined {
    return this.db.prepare("SELECT * FROM books WHERE id = ?").get(id) as
      | unknown as Book | undefined;
  }

  create(input: BookInput): Book {
    return this.db
      .prepare(
        `INSERT INTO books
           (isbn, title, author, publisher, category, price, release_date, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`,
      )
      .get(
        input.isbn ?? null,
        input.title,
        input.author ?? null,
        input.publisher ?? null,
        input.category,
        input.price ?? null,
        input.release_date,
        input.description ?? null,
      ) as unknown as Book;
  }

  /** 全項目を置き換える更新。対象が存在しなければ undefined を返す */
  update(id: number, input: BookInput): Book | undefined {
    return this.db
      .prepare(
        `UPDATE books SET
           isbn = ?, title = ?, author = ?, publisher = ?,
           category = ?, price = ?, release_date = ?, description = ?,
           updated_at = datetime('now')
         WHERE id = ?
         RETURNING *`,
      )
      .get(
        input.isbn ?? null,
        input.title,
        input.author ?? null,
        input.publisher ?? null,
        input.category,
        input.price ?? null,
        input.release_date,
        input.description ?? null,
        id,
      ) as unknown as Book | undefined;
  }

  /** 削除できたら true、対象が無ければ false */
  delete(id: number): boolean {
    const result = this.db.prepare("DELETE FROM books WHERE id = ?").run(id);
    return result.changes > 0;
  }
}