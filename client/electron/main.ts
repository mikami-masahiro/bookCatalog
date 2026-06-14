import { app, BrowserWindow } from "electron";
import path from "node:path";

// レンダラが叩く API サーバーの URL。リモート URL 方式（サーバーは別途起動）。
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
// 開発時は vite-plugin-electron が dev サーバー URL を渡す。
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow(): void {
	const win = new BrowserWindow({
		width: 1100,
		height: 800,
		autoHideMenuBar: true,
		// 開発時のウィンドウアイコン（パッケージ版の exe アイコンは electron-builder が付与）
		icon: path.join(import.meta.dirname, "../build/icon.ico"),
		webPreferences: {
			preload: path.join(import.meta.dirname, "preload.mjs"),
			contextIsolation: true,
			nodeIntegration: false,
			additionalArguments: [`--api-base-url=${API_BASE_URL}`],
		},
	});

	if (DEV_SERVER_URL) {
		void win.loadURL(DEV_SERVER_URL);
	} else {
		void win.loadFile(path.join(import.meta.dirname, "../dist/index.html"));
	}
}

void app.whenReady().then(() => {
	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
