import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { bookInputSchema, listQuerySchema } from "../schemas.js";
import type { BookRepository } from "../repositories/bookRepository.js";

/** パスパラメータ :id を正の整数として解釈する。失敗時は null */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** /api/books 配下のルーティングを生成する */
export function booksRouter(repo: BookRepository): Hono {
  const router = new Hono();

  // 一覧（絞り込み・検索・ページング）
  router.get("/", zValidator("query", listQuerySchema), (c) => {
    const query = c.req.valid("query");
    const { items, total } = repo.list(query);
    return c.json({ items, total, limit: query.limit, offset: query.offset });
  });

  // 1 件取得
  router.get("/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id === null) return c.json({ error: "id が不正です" }, 400);

    const book = repo.findById(id);
    if (!book) return c.json({ error: "見つかりません" }, 404);
    return c.json(book);
  });

  // 新規登録
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

  // 更新（全項目置き換え）
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

  // 削除
  router.delete("/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id === null) return c.json({ error: "id が不正です" }, 400);

    if (!repo.delete(id)) return c.json({ error: "見つかりません" }, 404);
    return c.body(null, 204);
  });

  return router;
}

/** SQLite の UNIQUE 制約違反かどうかを判定する */
function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}