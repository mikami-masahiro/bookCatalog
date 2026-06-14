import { db } from "./db/index.js";
import { BookRepository } from "./repositories/bookRepository.js";
import type { BookWriteInput } from "./repositories/bookRepository.js";

const unix = (iso: string): number => Math.floor(new Date(iso).getTime() / 1000);

const samples: BookWriteInput[] = [
	{
		isbn: "9784101010014",
		title: "こころ",
		author: "夏目 漱石",
		publisher: "新潮社",
		category: "0093", // C コード：一般・単行本・日本文学（小説）
		price: 539,
		release_date: unix("2026-06-01T00:00:00Z"),
		description: "サンプルデータ：近代日本文学の代表作。",
	},
	{
		isbn: "9784000000000",
		title: "プログラミング入門",
		author: "情報 太郎",
		publisher: "技術評論社",
		category: "3055", // C コード：専門・全集／双書・電子通信
		price: 2980,
		release_date: unix("2026-06-10T00:00:00Z"),
		description: "サンプルデータ：初学者向け解説書。",
	},
	{
		isbn: null,
		title: "月刊テックマガジン 2026年7月号",
		author: null,
		publisher: "サンプル出版",
		category: null, // 雑誌は C コードを持たない
		price: 1200,
		release_date: unix("2026-06-21T00:00:00Z"),
		description: "サンプルデータ：技術系月刊誌。",
	},
];

const repo = new BookRepository(db);

let inserted = 0;
for (const sample of samples) {
	try {
		repo.create(sample);
		inserted += 1;
	} catch (err) {
		// ISBN 重複は投入済みとみなしてスキップ
		if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message)) {
			continue;
		}
		throw err;
	}
}

console.log(`Seed 完了: ${inserted} 件登録しました。`);
