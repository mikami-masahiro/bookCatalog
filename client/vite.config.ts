import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";

// Electron ビルド/開発時のみ vite-plugin-electron を有効化する。
// 通常の vite build はブラウザ向け SPA をそのまま出力する。
const isElectron = process.env.TARGET === "electron";

export default defineConfig({
	// Electron は file:// から読み込むため相対パスにする。ブラウザは絶対パス。
	base: isElectron ? "./" : "/",
	plugins: [
		react(),
		...(isElectron
			? [
					electron({
						main: { entry: "electron/main.ts" },
						preload: { input: "electron/preload.ts" },
					}),
				]
			: []),
	],
	server: {
		port: 5173,
		// ブラウザ開発時は API を同一オリジン扱いにし CORS を回避する。
		proxy: {
			"/api": "http://localhost:3000",
			"/health": "http://localhost:3000",
		},
	},
	build: { outDir: "dist" },
});
