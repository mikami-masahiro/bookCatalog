import { contextBridge } from "electron";

// main プロセスから --api-base-url=... で渡されたサーバー URL をレンダラへ公開する。
// 公開するのは文字列のみ（Node API はレンダラに漏らさない）。
const PREFIX = "--api-base-url=";
const arg = process.argv.find((a) => a.startsWith(PREFIX));
const apiBaseUrl = arg ? arg.slice(PREFIX.length) : "http://localhost:3000";

contextBridge.exposeInMainWorld("__API_BASE_URL__", apiBaseUrl);
