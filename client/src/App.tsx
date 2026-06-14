import { useEffect, useState } from "react";
import { api, ApiError, type Book } from "./api/client";
import { loadSettings, saveSettings, type Settings } from "./settings";

// release_date は UNIX time（秒）。表示用に YYYY-MM-DD へ整形する。
function formatDate(unixSec: number): string {
	return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

// サイドバーのメニュー項目。
const menuItems = [
	{ id: "books", label: "書籍一覧" },
	{ id: "settings", label: "設定" },
] as const;
type MenuId = (typeof menuItems)[number]["id"];

// フォントサイズの調整範囲（px）
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 24;

export function App() {
	const [active, setActive] = useState<MenuId>("books");
	const [settings, setSettings] = useState<Settings>(loadSettings);

	// サーバー URL を起動時・変更時に API クライアントへ反映する。
	useEffect(() => {
		api.configure(settings.serverUrl);
	}, [settings.serverUrl]);

	function update(patch: Partial<Settings>) {
		setSettings((prev) => {
			const next = { ...prev, ...patch };
			saveSettings(next);
			return next;
		});
	}

	const dark = settings.darkMode;
	return (
		<div style={{ ...layout, fontSize: settings.fontSize, ...(dark ? layoutDark : null) }}>
			<aside style={{ ...sidebar, ...(dark ? sidebarDark : null) }}>
				<h1 style={brand}>Book Catalog</h1>
				<nav>
					{menuItems.map((item) => (
						<button
							key={item.id}
							onClick={() => setActive(item.id)}
							style={active === item.id ? { ...menuButton, ...menuButtonActive } : menuButton}
						>
							{item.label}
						</button>
					))}
				</nav>
			</aside>
			<main style={{ ...content, ...(dark ? contentDark : null) }}>
				{active === "books" && <BookList dark={dark} />}
				{active === "settings" && <SettingsView settings={settings} onChange={update} />}
			</main>
		</div>
	);
}

function BookList({ dark }: { dark: boolean }) {
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
		void reload();
	}, []);

	const borderColor = dark ? "#374151" : "#eee";
	const headColor = dark ? "#4b5563" : "#ccc";

	return (
		<>
			<h2>書籍一覧</h2>
			<p>
				<button onClick={reload} disabled={loading}>
					再読み込み
				</button>
			</p>

			{error && <p style={{ color: dark ? "#f87171" : "crimson" }}>エラー: {error}</p>}
			{loading ? (
				<p>読み込み中…</p>
			) : (
				<>
					<p>新刊 {total} 件</p>
					<table style={{ borderCollapse: "collapse", width: "100%" }}>
						<thead>
							<tr>
								<th style={{ ...th, borderBottomColor: headColor }}>発売日</th>
								<th style={{ ...th, borderBottomColor: headColor }}>区分</th>
								<th style={{ ...th, borderBottomColor: headColor }}>タイトル</th>
								<th style={{ ...th, borderBottomColor: headColor }}>著者</th>
								<th style={{ ...th, borderBottomColor: headColor }}>出版社</th>
								<th style={{ ...th, borderBottomColor: headColor }}>価格</th>
							</tr>
						</thead>
						<tbody>
							{books.map((book) => (
								<tr key={book.id}>
									<td style={{ ...td, borderBottomColor: borderColor }}>{formatDate(book.release_date)}</td>
									<td style={{ ...td, borderBottomColor: borderColor }}>{book.category === "magazine" ? "雑誌" : "書籍"}</td>
									<td style={{ ...td, borderBottomColor: borderColor }}>{book.title}</td>
									<td style={{ ...td, borderBottomColor: borderColor }}>{book.author ?? "—"}</td>
									<td style={{ ...td, borderBottomColor: borderColor }}>{book.publisher ?? "—"}</td>
									<td style={{ ...td, borderBottomColor: borderColor }}>{book.price != null ? `¥${book.price}` : "—"}</td>
								</tr>
							))}
						</tbody>
					</table>
					{books.length === 0 && <p>データがありません（server で npm run seed を実行してください）。</p>}
				</>
			)}
		</>
	);
}

function SettingsView({
	settings,
	onChange,
}: {
	settings: Settings;
	onChange: (patch: Partial<Settings>) => void;
}) {
	const [health, setHealth] = useState<string>("未確認");
	const [checking, setChecking] = useState(false);

	async function checkHealth() {
		setChecking(true);
		setHealth("確認中…");
		try {
			const h = await api.health();
			setHealth(h.status);
		} catch {
			setHealth("到達不可");
		} finally {
			setChecking(false);
		}
	}

	return (
		<>
			<h2>設定</h2>

			<div style={field}>
				<label style={label}>フォントサイズ</label>
				<button
					onClick={() => onChange({ fontSize: Math.max(MIN_FONT_SIZE, settings.fontSize - 1) })}
					disabled={settings.fontSize <= MIN_FONT_SIZE}
					aria-label="フォントサイズを小さく"
					style={stepButton}
				>
					−
				</button>
				<span style={{ display: "inline-block", minWidth: "3.5rem", textAlign: "center" }}>
					{settings.fontSize}px
				</span>
				<button
					onClick={() => onChange({ fontSize: Math.min(MAX_FONT_SIZE, settings.fontSize + 1) })}
					disabled={settings.fontSize >= MAX_FONT_SIZE}
					aria-label="フォントサイズを大きく"
					style={stepButton}
				>
					＋
				</button>
			</div>

			<div style={field}>
				<label style={checkboxLabel}>
					ダークモード
					<input
						type="checkbox"
						checked={settings.darkMode}
						onChange={(e) => onChange({ darkMode: e.target.checked })}
						style={checkbox}
					/>
				</label>
			</div>

			<div style={field}>
				<label style={label}>サーバーURL</label>
				<input
					type="text"
					value={settings.serverUrl}
					placeholder="（既定: 同一オリジン / 環境設定）"
					onChange={(e) => onChange({ serverUrl: e.target.value })}
					style={{ width: "100%", maxWidth: 360, boxSizing: "border-box" }}
				/>
				<p style={{ margin: "0.5rem 0 0" }}>
					<button onClick={checkHealth} disabled={checking}>
						ヘルスチェック
					</button>
					{"　"}
					API ヘルス: <strong>{health}</strong>
				</p>
			</div>
		</>
	);
}

const layout: React.CSSProperties = { display: "flex", minHeight: "100vh", fontFamily: "sans-serif" };
const layoutDark: React.CSSProperties = { background: "#111827" };
// メインからほのかに浮かせる薄いグレー背景。区切りは右境界線。色はモードに追従する。
const sidebar: React.CSSProperties = {
	width: 220,
	flexShrink: 0,
	background: "#f4f5f7",
	padding: "1.5rem 1rem",
	boxSizing: "border-box",
	borderRight: "1px solid #e5e7eb",
};
const sidebarDark: React.CSSProperties = {
	background: "#161d2b",
	color: "#f9fafb",
	borderRight: "1px solid #374151",
};
const brand: React.CSSProperties = { fontSize: "1.25rem", margin: "0 0 1.5rem" };
const menuButton: React.CSSProperties = {
	display: "block",
	width: "100%",
	textAlign: "left",
	padding: "0.5rem 0.75rem",
	marginBottom: "0.25rem",
	background: "transparent",
	color: "inherit",
	border: "none",
	borderRadius: 6,
	cursor: "pointer",
	font: "inherit",
};
// ライト/ダーク両方の背景で視認できる半透明のハイライト。
const menuButtonActive: React.CSSProperties = { background: "rgba(127, 127, 127, 0.25)", fontWeight: 600 };
const content: React.CSSProperties = { flex: 1, padding: "2rem", maxWidth: 900 };
const contentDark: React.CSSProperties = { background: "#111827", color: "#f9fafb" };

const field: React.CSSProperties = { margin: "0 0 1.25rem" };
const label: React.CSSProperties = { display: "block", marginBottom: "0.35rem", fontWeight: 600 };
// チェックボックスをテキストの右側へ。inline-flex で並べ、間隔を空ける。
const checkboxLabel: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: "0.5rem", fontWeight: 600 };
const checkbox: React.CSSProperties = { width: 18, height: 18 };
// ＋／− を同じ大きさに揃える固定サイズ。
const stepButton: React.CSSProperties = { width: 32, height: 32, padding: 0, lineHeight: 1 };

const th: React.CSSProperties = { borderBottom: "2px solid #ccc", textAlign: "left", padding: "4px 8px" };
const td: React.CSSProperties = { borderBottom: "1px solid #eee", padding: "4px 8px" };
