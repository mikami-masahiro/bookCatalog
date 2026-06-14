CREATE TABLE IF NOT EXISTS books (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn         TEXT UNIQUE,
  title        TEXT NOT NULL,
  author       TEXT,
  publisher    TEXT,
  category     TEXT,
  -- 生の C コード（日本の書籍分類コード, 4 桁。例 '0093'）。不明な場合は NULL
  price        INTEGER CHECK (price IS NULL OR price >= 0),
  release_date INTEGER NOT NULL,
  description  TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_books_release_date ON books (release_date);
CREATE INDEX IF NOT EXISTS idx_books_category     ON books (category);
CREATE INDEX IF NOT EXISTS idx_books_publisher    ON books (publisher);
