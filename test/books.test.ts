import { test } from "node:test";
import assert from "node:assert/strict";
import { createDatabase } from "../src/db/index.js";
import { createApp } from "../src/app.js";
import { BookRepository } from "../src/repositories/bookRepository.js";

function setup() {
	const db = createDatabase(":memory:");
	return createApp(db);
}

const unix = (iso: string): number => Math.floor(new Date(iso).getTime() / 1000);

const sample = {
	isbn: "9784101010014",
	title: "こころ",
	author: "夏目 漱石",
	publisher: "新潮社",
	category: "book",
	price: 539,
	release_date: unix("2026-06-01T00:00:00Z"),
};

test("health チェックが ok を返す", async () => {
	const app = setup();
	const res = await app.request("/health");
	assert.equal(res.status, 200);
	assert.deepEqual(await res.json(), { status: "ok" });
});

test("新刊を登録して取得できる", async () => {
	const app = setup();

	const created = await app.request("/api/books/create", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(sample),
	});
	assert.equal(created.status, 201);
	const book = (await created.json()) as { id: number; title: string };
	assert.equal(book.title, "こころ");

	const got = await app.request(`/api/books/${book.id}`);
	assert.equal(got.status, 200);
});

test("不正な入力は 400 を返す", async () => {
	const app = setup();
	const res = await app.request("/api/books/create", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ title: "" }),
	});
	assert.equal(res.status, 400);
});

test("ISBN 重複は 409 を返す", async () => {
	const app = setup();
	const body = JSON.stringify(sample);
	const headers = { "content-type": "application/json" };

	await app.request("/api/books/create", { method: "POST", headers, body });
	const dup = await app.request("/api/books/create", { method: "POST", headers, body });
	assert.equal(dup.status, 409);
});

test("区分と検索で絞り込める", async () => {
	const app = setup();
	const headers = { "content-type": "application/json" };

	await app.request("/api/books/create", {
		method: "POST",
		headers,
		body: JSON.stringify(sample),
	});
	await app.request("/api/books/create", {
		method: "POST",
		headers,
		body: JSON.stringify({
			title: "月刊サンプル 2026年7月号",
			publisher: "サンプル出版",
			category: "magazine",
			release_date: unix("2026-06-21T00:00:00Z"),
		}),
	});

	const onlyMagazine = await app.request("/api/books?category=magazine");
	const result = (await onlyMagazine.json()) as { total: number };
	assert.equal(result.total, 1);

	const search = await app.request("/api/books?q=" + encodeURIComponent("こころ"));
	const searchResult = (await search.json()) as { total: number };
	assert.equal(searchResult.total, 1);
});

test("更新と削除ができる", async () => {
	const app = setup();
	const headers = { "content-type": "application/json" };

	const created = await app.request("/api/books/create", {
		method: "POST",
		headers,
		body: JSON.stringify(sample),
	});
	const book = (await created.json()) as { id: number };

	const updated = await app.request(`/api/books/update/${book.id}`, {
		method: "POST",
		headers,
		body: JSON.stringify({ ...sample, price: 600 }),
	});
	assert.equal(updated.status, 200);
	const updatedBook = (await updated.json()) as { price: number };
	assert.equal(updatedBook.price, 600);

	const deleted = await app.request(`/api/books/delete/${book.id}`, { method: "POST" });
	assert.equal(deleted.status, 204);

	const gone = await app.request(`/api/books/${book.id}`);
	assert.equal(gone.status, 404);
});

test("upsertByIsbn は新規挿入し、同 ISBN で再呼び出すと同 id で上書きする", () => {
	const db = createDatabase(":memory:");
	const repo = new BookRepository(db);

	const input = {
		isbn: "9784101010014",
		title: "こころ",
		author: "夏目 漱石",
		publisher: "新潮社",
		category: "book" as const,
		price: 539,
		release_date: unix("2026-06-01T00:00:00Z"),
		description: null,
	};

	const created = repo.upsertByIsbn(input);
	assert.equal(created.title, "こころ");
	assert.equal(created.price, 539);

	const updated = repo.upsertByIsbn({ ...input, title: "こゝろ", price: 600 });
	assert.equal(updated.id, created.id);
	assert.equal(updated.title, "こゝろ");
	assert.equal(updated.price, 600);
	assert.equal(updated.created_at, created.created_at);

	const total = repo.list({ limit: 20, offset: 0 }).total;
	assert.equal(total, 1);
});
