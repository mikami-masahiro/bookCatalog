import createClient from "openapi-fetch";
import type { paths, components } from "./schema";
import { API_BASE_URL } from "./config";

export type Book = components["schemas"]["Book"];
export type BookInput = components["schemas"]["BookInput"];
export type BookListResult = components["schemas"]["BookListResult"];
export type ListQuery = NonNullable<paths["/api/books"]["get"]["parameters"]["query"]>;

// 設定画面から接続先を切り替えられるよう、クライアントは再生成可能にする。
let client = createClient<paths>({ baseUrl: API_BASE_URL });

// サーバーは失敗時 { error: string } を返す。状態コード付きで投げ直す。
export class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

type ErrorBody = components["schemas"]["Error"];

function fail(status: number, error: unknown): never {
	const message =
		error && typeof error === "object" && "error" in error
			? (error as ErrorBody).error
			: `HTTP ${status}`;
	throw new ApiError(status, message);
}

// openapi-fetch の戻り値からデータを取り出す。失敗時は ApiError を投げる。
function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
	if (result.data === undefined) {
		fail(result.response.status, result.error);
	}
	return result.data;
}

export const api = {
	// 接続先サーバー URL を切り替える（設定画面から）。空文字なら既定に戻す。
	configure(serverUrl: string): void {
		client = createClient<paths>({ baseUrl: serverUrl || API_BASE_URL });
	},

	health(): Promise<{ status: string }> {
		return client.GET("/health").then(unwrap);
	},

	list(query: ListQuery = {}): Promise<BookListResult> {
		return client.GET("/api/books", { params: { query } }).then(unwrap);
	},

	get(id: number): Promise<Book> {
		return client.GET("/api/books/{id}", { params: { path: { id } } }).then(unwrap);
	},

	// OpenBD から取得（DB には保存されない）
	openbd(isbn: string): Promise<Book> {
		return client.GET("/api/books/openbd/{isbn}", { params: { path: { isbn } } }).then(unwrap);
	},

	create(input: BookInput): Promise<Book> {
		return client.POST("/api/books/create", { body: input }).then(unwrap);
	},

	update(id: number, input: BookInput): Promise<Book> {
		return client.POST("/api/books/update/{id}", { params: { path: { id } }, body: input }).then(unwrap);
	},

	async remove(id: number): Promise<void> {
		const { error, response } = await client.POST("/api/books/delete/{id}", {
			params: { path: { id } },
		});
		if (error) fail(response.status, error);
	},
};
