import { Hono } from "hono";
import { logger } from "hono/logger";
import type { DatabaseSync } from "node:sqlite";
import { BookRepository } from "./repositories/bookRepository.js";
import { booksRouter } from "./routes/books.js";

export function createApp(db: DatabaseSync): Hono {
	const app = new Hono();

	app.use("*", logger());

	app.get("/health", (c) => c.json({ status: "ok" }));

	app.route("/api/books", booksRouter(new BookRepository(db)));

	app.notFound((c) => c.json({ error: "見つかりません" }, 404));

	app.onError((err, c) => {
		console.error(err);
		return c.json({ error: "サーバー内部エラー" }, 500);
	});

	return app;
}
