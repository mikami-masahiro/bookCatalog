import type { Book } from "../types.js";

const ENDPOINT = "https://api.openbd.jp/v1/get";

export class OpenBdError extends Error {}

// onix は階層が深く OpenBD 側のスキーマ変更も多いため any で受ける
type OpenBdRecord = {
	summary?: {
		isbn?: string;
		title?: string;
		author?: string;
		publisher?: string;
		pubdate?: string;
	};
	onix?: any;
};

export async function fetchBookFromOpenBd(isbn: string): Promise<Book | null> {
	let res;
	try {
		res = await fetch(`${ENDPOINT}?isbn=${encodeURIComponent(isbn)}`);
	} catch (err) {
		throw new OpenBdError(`OpenBD への接続に失敗しました: ${String(err)}`);
	}
	if (!res.ok) {
		throw new OpenBdError(`OpenBD が ${res.status} を返しました`);
	}

	const data = (await res.json()) as unknown[];
	const record = Array.isArray(data) ? data[0] : null;
	if (!record) return null; // 見つからない場合は [null] が返る
	return mapRecordToBook(record as OpenBdRecord, isbn);
}

// OpenBD レコードを books テーブルと同一形状の Book に変換する
export function mapRecordToBook(record: OpenBdRecord, requestedIsbn: string): Book {
	const summary = record.summary ?? {};
	const ts = Math.floor(Date.now() / 1000);
	return {
		id: 0, // 未保存のため採番なし
		isbn: summary.isbn || requestedIsbn || null,
		title: summary.title ?? "",
		author: summary.author || null,
		publisher: summary.publisher || null,
		category: "book",
		price: extractPrice(record.onix),
		release_date: parsePubdate(summary.pubdate) ?? 0,
		description: extractDescription(record.onix),
		created_at: ts,
		updated_at: ts,
	};
}

function extractPrice(onix: any): number | null {
	const prices = onix?.ProductSupply?.SupplyDetail?.Price;
	if (!Array.isArray(prices)) return null;
	for (const p of prices) {
		const amount = Number(p?.PriceAmount);
		if (Number.isFinite(amount)) return Math.round(amount);
	}
	return null;
}

function extractDescription(onix: any): string | null {
	const contents = onix?.CollateralDetail?.TextContent;
	if (!Array.isArray(contents)) return null;
	const text = contents.find((c: any) => c?.Text)?.Text;
	return text ? String(text) : null;
}

// pubdate は "YYYYMMDD" / "YYYYMM" / "YYYY" / ハイフン区切り等が混在する
function parsePubdate(pubdate: unknown): number | null {
	if (typeof pubdate !== "string") return null;
	const digits = pubdate.replace(/\D/g, "");
	if (digits.length < 4) return null;
	const year = Number(digits.slice(0, 4));
	const month = Number(digits.slice(4, 6) || "1");
	const day = Number(digits.slice(6, 8) || "1");
	const ms = Date.UTC(year, month - 1, day);
	return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}
