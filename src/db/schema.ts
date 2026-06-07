import type { DatabaseSync } from "node:sqlite";

/**
 * テーブルとインデックスを冪等に作成する。
 * 起動時に必ず呼び出され、存在しない場合のみ作成される。
 */
export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      isbn         TEXT UNIQUE,
      title        TEXT NOT NULL,
      author       TEXT,
      publisher    TEXT,
      category     TEXT NOT NULL DEFAULT 'book'
                     CHECK (category IN ('book', 'magazine')),
      price        INTEGER CHECK (price IS NULL OR price >= 0),
      release_date TEXT NOT NULL,
      description  TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_books_release_date ON books (release_date);
    CREATE INDEX IF NOT EXISTS idx_books_category     ON books (category);
    CREATE INDEX IF NOT EXISTS idx_books_publisher    ON books (publisher);
  `);
}
