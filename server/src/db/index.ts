import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export function initSchema(db: DatabaseSync): void {
	const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
	db.exec(sql);
}

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

export const db = createDatabase(process.env.DATABASE_PATH ?? "data/app.db");
