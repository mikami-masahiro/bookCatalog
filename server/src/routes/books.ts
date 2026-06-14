import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { fetchBookFromOpenBd, OpenBdError } from "../services/openbd.js";
import type {
	BookRepository,
	BookWriteInput,
	BookListQuery,
} from "../repositories/bookRepository.js";

// books テーブルの行に対応するレスポンス形状（src/types.ts の Book と一致させる）
const bookSchema = z
	.object({
		id: z.number().int(),
		isbn: z.string().nullable(), // 雑誌など ISBN を持たない刊行物は null
		title: z.string(),
		author: z.string().nullable(),
		publisher: z.string().nullable(),
		category: z.string().nullable(), // 生の C コード（4 桁。例 "0093"）
		price: z.number().int().nullable(), // 税込・円
		release_date: z.number().int(), // UNIX time（秒）
		description: z.string().nullable(),
		created_at: z.number().int(), // UNIX time（秒）
		updated_at: z.number().int(), // UNIX time（秒）
	})
	.openapi("Book");

const bookInputSchema = z
	.object({
		isbn: z.string().trim().min(1).max(20).nullish(),
		title: z.string().trim().min(1).max(500),
		author: z.string().trim().max(500).nullish(),
		publisher: z.string().trim().max(500).nullish(),
		category: z.string().trim().max(20).nullish(), // 生の C コード（4 桁）
		price: z.number().int().nonnegative().nullish(),
		release_date: z.number().int(), // UNIX time（秒）
		description: z.string().trim().max(5000).nullish(),
	})
	.openapi("BookInput");

type BookInput = z.infer<typeof bookInputSchema>;

const listQuerySchema = z.object({
	category: z.string().trim().min(1).optional(), // C コード完全一致
	publisher: z.string().trim().min(1).optional(), // 完全一致
	q: z.string().trim().min(1).optional(), // タイトル・著者名の部分一致
	from: z.coerce.number().int().optional(), // 発売日の下限（含む, UNIX time 秒）
	to: z.coerce.number().int().optional(), // 発売日の上限（含む, UNIX time 秒）
	limit: z.coerce.number().int().min(1).max(100).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});

type ListQuery = z.infer<typeof listQuerySchema>;

const listResultSchema = z
	.object({
		items: z.array(bookSchema),
		total: z.number().int(),
		limit: z.number().int(),
		offset: z.number().int(),
	})
	.openapi("BookListResult");

const errorSchema = z.object({ error: z.string() }).openapi("Error");

const idParamSchema = z.object({
	id: z.coerce.number().int().positive().openapi({ param: { name: "id", in: "path" }, example: 1 }),
});

const isbnParamSchema = z.object({
	isbn: z.string().openapi({ param: { name: "isbn", in: "path" }, example: "9784873119045" }),
});

// 検証済みの入力をリポジトリの書き込み入力へ詰め替える（未指定は null に正規化）
function toWriteInput(input: BookInput): BookWriteInput {
	return {
		isbn: input.isbn ?? null,
		title: input.title,
		author: input.author ?? null,
		publisher: input.publisher ?? null,
		category: input.category ?? null,
		price: input.price ?? null,
		release_date: input.release_date,
		description: input.description ?? null,
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

const jsonError = (description: string) => ({
	content: { "application/json": { schema: errorSchema } },
	description,
});

const listRoute = createRoute({
	method: "get",
	path: "/",
	request: { query: listQuerySchema },
	responses: {
		200: { content: { "application/json": { schema: listResultSchema } }, description: "一覧" },
	},
});

const openbdRoute = createRoute({
	method: "get",
	path: "/openbd/{isbn}",
	request: { params: isbnParamSchema },
	responses: {
		200: { content: { "application/json": { schema: bookSchema } }, description: "OpenBD から取得（DB 未保存）" },
		404: jsonError("該当なし"),
		502: jsonError("OpenBD 連携エラー"),
	},
});

const getRoute = createRoute({
	method: "get",
	path: "/{id}",
	request: { params: idParamSchema },
	responses: {
		200: { content: { "application/json": { schema: bookSchema } }, description: "1 件取得" },
		404: jsonError("見つかりません"),
	},
});

const createBookRoute = createRoute({
	method: "post",
	path: "/create",
	request: { body: { content: { "application/json": { schema: bookInputSchema } } } },
	responses: {
		201: { content: { "application/json": { schema: bookSchema } }, description: "新規登録" },
		409: jsonError("ISBN 重複"),
	},
});

const updateRoute = createRoute({
	method: "post",
	path: "/update/{id}",
	request: {
		params: idParamSchema,
		body: { content: { "application/json": { schema: bookInputSchema } } },
	},
	responses: {
		200: { content: { "application/json": { schema: bookSchema } }, description: "更新（全項目置き換え）" },
		404: jsonError("見つかりません"),
		409: jsonError("ISBN 重複"),
	},
});

const deleteRoute = createRoute({
	method: "post",
	path: "/delete/{id}",
	request: { params: idParamSchema },
	responses: {
		204: { description: "削除" },
		404: jsonError("見つかりません"),
	},
});

export function booksRouter(repo: BookRepository): OpenAPIHono {
	const router = new OpenAPIHono({
		defaultHook: (result, c) => {
			if (!result.success) {
				return c.json({ error: "入力が不正です" }, 400);
			}
		},
	});

	router.openapi(listRoute, (c) => {
		const query = c.req.valid("query");
		const { items, total } = repo.list(toListQuery(query));
		return c.json({ items, total, limit: query.limit, offset: query.offset }, 200);
	});

	router.openapi(openbdRoute, async (c) => {
		const { isbn } = c.req.valid("param");
		try {
			const book = await fetchBookFromOpenBd(isbn);
			if (!book) return c.json({ error: "OpenBD に該当の書籍が見つかりません" }, 404);
			return c.json(book, 200);
		} catch (err) {
			if (err instanceof OpenBdError) return c.json({ error: err.message }, 502);
			throw err;
		}
	});

	router.openapi(getRoute, (c) => {
		const { id } = c.req.valid("param");
		const book = repo.findById(id);
		if (!book) return c.json({ error: "見つかりません" }, 404);
		return c.json(book, 200);
	});

	router.openapi(createBookRoute, (c) => {
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

	router.openapi(updateRoute, (c) => {
		const { id } = c.req.valid("param");
		const input = c.req.valid("json");
		try {
			const book = repo.update(id, toWriteInput(input));
			if (!book) return c.json({ error: "見つかりません" }, 404);
			return c.json(book, 200);
		} catch (err) {
			if (isUniqueViolation(err)) {
				return c.json({ error: "同じ ISBN が既に登録されています" }, 409);
			}
			throw err;
		}
	});

	router.openapi(deleteRoute, (c) => {
		const { id } = c.req.valid("param");
		if (!repo.delete(id)) return c.json({ error: "見つかりません" }, 404);
		return c.body(null, 204);
	});

	return router;
}

function isUniqueViolation(err: unknown): boolean {
	return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}
