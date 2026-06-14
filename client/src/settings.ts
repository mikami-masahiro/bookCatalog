// クライアントの表示・接続設定。localStorage に永続化する。
export type Settings = {
	fontSize: number; // px
	darkMode: boolean;
	serverUrl: string; // 空なら既定（config の API_BASE_URL）を使う
};

const KEY = "book-catalog-settings";

const defaults: Settings = { fontSize: 16, darkMode: false, serverUrl: "" };

export function loadSettings(): Settings {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return { ...defaults };
		return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
	} catch {
		return { ...defaults };
	}
}

export function saveSettings(settings: Settings): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(settings));
	} catch {
		// localStorage 不可（プライベートモード等）でも動作は続行する
	}
}
