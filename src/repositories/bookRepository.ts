import type { DatabaseSync } from "node:sqlite";
import type { Book, Category } from "../types.js";

// リポジトリが受け取る書き込み入力。ルート層で検証済み BookInput から詰め替える
export interface BookWriteInput {
	isbn: string | null;
	title: string;
	author: string | null;
	publisher: string | null;
	category: Category;
	price: number | null;
	release_date: number;
	description: string | null;
}

// 一覧の絞り込み条件。検証・既定値適用済みの値を受け取る
export interface BookListQuery {
	category?: Category;
	publisher?: string;
	q?: string;
	from?: number;
	to?: number;
	limit: number;
	offset: number;
}

export interface ListResult {
	items: Book[];
	total: number;
}

export class BookRepository {
	constructor(private readonly db: DatabaseSync) {}

	list(query: BookListQuery): ListResult {
		const where: string[] = [];
		const params: (string | number)[] = [];

		if (query.category) {
			where.push("category = ?");
			params.push(query.category);
		}
		if (query.publisher) {
			where.push("publisher = ?");
			params.push(query.publisher);
		}
		if (query.from) {
			where.push("release_date >= ?");
			params.push(query.from);
		}
		if (query.to) {
			where.push("release_date <= ?");
			params.push(query.to);
		}
		if (query.q) {
			where.push("(title LIKE ? OR author LIKE ?)");
			const like = `%${query.q}%`;
			params.push(like, like);
		}

		const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

		const countRow = this.db
			.prepare(`SELECT COUNT(*) AS c FROM books ${whereSql}`)
			.get(...params) as { c: number };

		// node:sqlite は Record<string, SQLOutputValue> を返すため二段キャスト
		const items = this.db
			.prepare(`SELECT * FROM books ${whereSql} ORDER BY release_date DESC, id DESC LIMIT ? OFFSET ?`)
			.all(...params, query.limit, query.offset) as unknown as Book[];

		return { items, total: countRow.c };
	}

	findById(id: number): Book | undefined {
		return this.db.prepare("SELECT * FROM books WHERE id = ?").get(id) as
			| unknown as Book | undefined;
	}

	create(input: BookWriteInput): Book {
		return this.db
			.prepare(`INSERT INTO books (isbn, title, author, publisher, category, price, release_date, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
			.get(
				input.isbn,
				input.title,
				input.author,
				input.publisher,
				input.category,
				input.price,
				input.release_date,
				input.description,
			) as unknown as Book;
	}

	// 全項目を置き換える（部分更新ではない）
	update(id: number, input: BookWriteInput): Book | undefined {
		return this.db
			.prepare(`UPDATE books SET isbn = ?, title = ?, author = ?, publisher = ?, category = ?, price = ?, release_date = ?, description = ?, updated_at = unixepoch() WHERE id = ? RETURNING *`)
			.get(
				input.isbn,
				input.title,
				input.author,
				input.publisher,
				input.category,
				input.price,
				input.release_date,
				input.description,
				id,
			) as unknown as Book | undefined;
	}

	delete(id: number): boolean {
		const result = this.db.prepare("DELETE FROM books WHERE id = ?").run(id);
		return result.changes > 0;
	}
}
