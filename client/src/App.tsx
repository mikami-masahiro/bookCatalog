import { useEffect, useState } from "react";
import { api, ApiError, type Book } from "./api/client";

// release_date は UNIX time（秒）。表示用に YYYY-MM-DD へ整形する。
function formatDate(unixSec: number): string {
	return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

export function App() {
	const [health, setHealth] = useState<string>("確認中…");
	const [books, setBooks] = useState<Book[]>([]);
	const [total, setTotal] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	async function reload() {
		setLoading(true);
		setError(null);
		try {
			const result = await api.list({ limit: 50 });
			setBooks(result.items);
			setTotal(result.total);
		} catch (err) {
			setError(err instanceof ApiError ? `${err.status}: ${err.message}` : String(err));
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		api.health()
			.then((h) => setHealth(h.status))
			.catch(() => setHealth("到達不可"));
		void reload();
	}, []);

	return (
		<main style={{ fontFamily: "sans-serif", maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
			<h1>Book Catalog</h1>
			<p>
				API ヘルス: <strong>{health}</strong>
				{"　"}
				<button onClick={reload} disabled={loading}>
					再読み込み
				</button>
			</p>

			{error && <p style={{ color: "crimson" }}>エラー: {error}</p>}
			{loading ? (
				<p>読み込み中…</p>
			) : (
				<>
					<p>新刊 {total} 件</p>
					<table style={{ borderCollapse: "collapse", width: "100%" }}>
						<thead>
							<tr>
								<th style={th}>発売日</th>
								<th style={th}>区分</th>
								<th style={th}>タイトル</th>
								<th style={th}>著者</th>
								<th style={th}>出版社</th>
								<th style={th}>価格</th>
							</tr>
						</thead>
						<tbody>
							{books.map((book) => (
								<tr key={book.id}>
									<td style={td}>{formatDate(book.release_date)}</td>
									<td style={td}>{book.category === "magazine" ? "雑誌" : "書籍"}</td>
									<td style={td}>{book.title}</td>
									<td style={td}>{book.author ?? "—"}</td>
									<td style={td}>{book.publisher ?? "—"}</td>
									<td style={td}>{book.price != null ? `¥${book.price}` : "—"}</td>
								</tr>
							))}
						</tbody>
					</table>
					{books.length === 0 && <p>データがありません（server で npm run seed を実行してください）。</p>}
				</>
			)}
		</main>
	);
}

const th: React.CSSProperties = { borderBottom: "2px solid #ccc", textAlign: "left", padding: "4px 8px" };
const td: React.CSSProperties = { borderBottom: "1px solid #eee", padding: "4px 8px" };
