import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { bookInputSchema, listQuerySchema } from "../schemas.js";
import { fetchBookFromOpenBd, OpenBdError } from "../services/openbd.js";
import type { BookRepository } from "../repositories/bookRepository.js";

function parseId(raw: string): number | null {
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}

export function booksRouter(repo: BookRepository): Hono {
	const router = new Hono();

	router.get("/", zValidator("query", listQuerySchema), (c) => {
		const query = c.req.valid("query");
		const { items, total } = repo.list(query);
		return c.json({ items, total, limit: query.limit, offset: query.offset });
	});

	router.get("/openbd/:isbn", async (c) => {
		const isbn = c.req.param("isbn");
		try {
			const book = await fetchBookFromOpenBd(isbn);
			if (!book) return c.json({ error: "OpenBD に該当の書籍が見つかりません" }, 404);
			return c.json(book);
		} catch (err) {
			if (err instanceof OpenBdError) return c.json({ error: err.message }, 502);
			throw err;
		}
	});

	router.get("/:id", (c) => {
		const id = parseId(c.req.param("id"));
		if (id === null) return c.json({ error: "id が不正です" }, 400);

		const book = repo.findById(id);
		if (!book) return c.json({ error: "見つかりません" }, 404);
		return c.json(book);
	});

	router.post("/", zValidator("json", bookInputSchema), (c) => {
		const input = c.req.valid("json");
		try {
			return c.json(repo.create(input), 201);
		} catch (err) {
			if (isUniqueViolation(err)) {
				return c.json({ error: "同じ ISBN が既に登録されています" }, 409);
			}
			throw err;
		}
	});

	router.put("/:id", zValidator("json", bookInputSchema), (c) => {
		const id = parseId(c.req.param("id"));
		if (id === null) return c.json({ error: "id が不正です" }, 400);

		const input = c.req.valid("json");
		try {
			const book = repo.update(id, input);
			if (!book) return c.json({ error: "見つかりません" }, 404);
			return c.json(book);
		} catch (err) {
			if (isUniqueViolation(err)) {
				return c.json({ error: "同じ ISBN が既に登録されています" }, 409);
			}
			throw err;
		}
	});

	router.delete("/:id", (c) => {
		const id = parseId(c.req.param("id"));
		if (id === null) return c.json({ error: "id が不正です" }, 400);

		if (!repo.delete(id)) return c.json({ error: "見つかりません" }, 404);
		return c.body(null, 204);
	});

	return router;
}

function isUniqueViolation(err: unknown): boolean {
	return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}
