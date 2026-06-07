import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { initSchema } from "./schema.js";

/**
 * SQLite データベースへ接続し、PRAGMA 設定とスキーマ初期化まで行う。
 * `:memory:` を渡すとインメモリ DB を作成する（テスト用）。
 */
export function createDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  initSchema(db);
  return db;
}

/** アプリ本体が使う既定のデータベース接続 */
export const db = createDatabase(process.env.DATABASE_PATH ?? "data/app.db");
