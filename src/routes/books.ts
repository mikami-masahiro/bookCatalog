import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { fetchBookFromOpenBd, OpenBdError } from "../services/openbd.js";
import type { Book } from "../types.js";
import type {
	BookRepository,
	BookWriteInput,
	BookListQuery,
} from "../repositories/bookRepository.js";

const bookInputSchema = z.object({
	isbn: z.string().trim().min(1).max(20).nullish(),
	title: z.string().trim().min(1).max(500),
	author: z.string().trim().max(500).nullish(),
	publisher: z.string().trim().max(500).nullish(),
	category: z.enum(["book", "magazine"]).default("book"),
	price: z.number().int().nonnegative().nullish(),
	release_date: z.number().int(), // UNIX time（秒）
	description: z.string().trim().max(5000).nullish(),
});

type BookInput = z.infer<typeof bookInputSchema>;

const listQuerySchema = z.object({
	category: z.enum(["book", "magazine"]).optional(),
	publisher: z.string().trim().min(1).optional(), // 完全一致
	q: z.string().trim().min(1).optional(), // タイトル・著者名の部分一致
	from: z.coerce.number().int().optional(), // 発売日の下限（含む, UNIX time 秒）
	to: z.coerce.number().int().optional(), // 発売日の上限（含む, UNIX time 秒）
	limit: z.coerce.number().int().min(1).max(100).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});

type ListQuery = z.infer<typeof listQuerySchema>;

function parseId(raw: string): number | null {
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}

// 検証済みの入力をリポジトリの書き込み入力へ詰め替える（未指定は null に正規化）
function toWriteInput(input: BookInput): BookWriteInput {
	return {
		isbn: input.isbn ?? null,
		title: input.title,
		author: input.author ?? null,
		publisher: input.publisher ?? null,
		category: input.category,
		price: input.price ?? null,
		release_date: input.release_date,
		description: input.description ?? null,
	};
}

function bookToWriteInput(book: Book): BookWriteInput {
	return {
		isbn: book.isbn,
		title: book.title,
		author: book.author,
		publisher: book.publisher,
		category: book.category,
		price: book.price,
		release_date: book.release_date,
		description: book.description,
	};
}

function toListQuery(query: ListQuery): BookListQuery {
	return {
		category: query.category,
		publisher: query.publisher,
		q: query.q,
		from: query.from,
		to: query.to,
		limit: query.limit,
		offset: query.offset,
	};
}

export function booksRouter(repo: BookRepository): Hono {
	const router = new Hono();

	router.get("/", zValidator("query", listQuerySchema), (c) => {
		const query = c.req.valid("query");
		const { items, total } = repo.list(toListQuery(query));
		return c.json({ items, total, limit: query.limit, offset: query.offset });
	});

	router.get("/openbd/load/:isbn", async (c) => {
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

	router.post("/openbd/import/:isbn", async (c) => {
		const isbn = c.req.param("isbn");
		let book;
		try {
			book = await fetchBookFromOpenBd(isbn);
		} catch (err) {
			if (err instanceof OpenBdError) return c.json({ error: err.message }, 502);
			throw err;
		}
		if (!book) return c.json({ error: "OpenBD に該当の書籍が見つかりません" }, 404);
		return c.json(repo.upsertByIsbn(bookToWriteInput(book)));
	});

	router.get("/:id", (c) => {
		const id = parseId(c.req.param("id"));
		if (id === null) return c.json({ error: "id が不正です" }, 400);

		const book = repo.findById(id);
		if (!book) return c.json({ error: "見つかりません" }, 404);
		return c.json(book);
	});

	router.post("/create", zValidator("json", bookInputSchema), (c) => {
		const input = c.req.valid("json");
		try {
			return c.json(repo.create(toWriteInput(input)), 201);
		} catch (err) {
			if (isUniqueViolation(err)) {
				return c.json({ error: "同じ ISBN が既に登録されています" }, 409);
			}
			throw err;
		}
	});

	router.post("/update/:id", zValidator("json", bookInputSchema), (c) => {
		const id = parseId(c.req.param("id"));
		if (id === null) return c.json({ error: "id が不正です" }, 400);

		const input = c.req.valid("json");
		try {
			const book = repo.update(id, toWriteInput(input));
			if (!book) return c.json({ error: "見つかりません" }, 404);
			return c.json(book);
		} catch (err) {
			if (isUniqueViolation(err)) {
				return c.json({ error: "同じ ISBN が既に登録されています" }, 409);
			}
			throw err;
		}
	});

	router.post("/delete/:id", (c) => {
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
