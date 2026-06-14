// API のベース URL を実行環境ごとに解決する。
// - ブラウザ開発: "" （同一オリジン → Vite プロキシ → :3000、CORS 不要）
// - ブラウザ本番: ビルド時の VITE_API_BASE_URL
// - Electron: preload が注入する window.__API_BASE_URL__（リモートのサーバー URL）
declare global {
	interface Window {
		__API_BASE_URL__?: string;
	}
}

export const API_BASE_URL: string =
	(typeof window !== "undefined" && window.__API_BASE_URL__) ||
	import.meta.env.VITE_API_BASE_URL ||
	"";
