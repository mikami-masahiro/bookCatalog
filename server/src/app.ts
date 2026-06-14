import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { swaggerUI } from "@hono/swagger-ui";
import type { DatabaseSync } from "node:sqlite";
import { BookRepository } from "./repositories/bookRepository.js";
import { booksRouter } from "./routes/books.js";

// ブラウザ別オリジン / Electron からのアクセスを許可する。
// CORS_ORIGINS（カンマ区切り）で上書き可。Electron の file:// は Origin が無い/"null"。
const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",");

const corsMiddleware = cors({
	origin: (origin) => {
		if (!origin || origin === "null") return origin || "*"; // Origin 無し（Electron 等）は許可
		return allowedOrigins.includes(origin) ? origin : allowedOrigins[0]!;
	},
});

const healthRoute = createRoute({
	method: "get",
	path: "/health",
	responses: {
		200: {
			content: { "application/json": { schema: z.object({ status: z.string() }) } },
			description: "ヘルスチェック",
		},
	},
});

export function createApp(db: DatabaseSync): OpenAPIHono {
	const app = new OpenAPIHono();

	app.use("*", logger());
	app.use("/api/*", corsMiddleware);
	app.use("/health", corsMiddleware);

	app.openapi(healthRoute, (c) => c.json({ status: "ok" }, 200));

	app.route("/api/books", booksRouter(new BookRepository(db)));

	app.doc("/openapi.json", {
		openapi: "3.0.0",
		info: { title: "Book Catalog API", version: "0.1.0" },
	});
	app.get("/docs", swaggerUI({ url: "/openapi.json" }));

	app.notFound((c) => c.json({ error: "見つかりません" }, 404));

	app.onError((err, c) => {
		console.error(err);
		return c.json({ error: "サーバー内部エラー" }, 500);
	});

	return app;
}
