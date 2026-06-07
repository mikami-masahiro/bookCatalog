import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { initSchema } from "./schema.js";

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
