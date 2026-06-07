import { db } from "./db/index.js";
import { BookRepository } from "./repositories/bookRepository.js";
import type { BookInput } from "./schemas.js";

/** 動作確認用のサンプル新刊データ */
const samples: BookInput[] = [
  {
    isbn: "9784101010014",
    title: "こころ",
    author: "夏目 漱石",
    publisher: "新潮社",
    category: "book",
    price: 539,
    release_date: "2026-06-01",
    description: "サンプルデータ：近代日本文学の代表作。",
  },
  {
    isbn: "9784000000000",
    title: "プログラミング入門",
    author: "情報 太郎",
    publisher: "技術評論社",
    category: "book",
    price: 2980,
    release_date: "2026-06-10",
    description: "サンプルデータ：初学者向け解説書。",
  },
  {
    isbn: null,
    title: "月刊テックマガジン 2026年7月号",
    author: null,
    publisher: "サンプル出版",
    category: "magazine",
    price: 1200,
    release_date: "2026-06-21",
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
    // 既に投入済み（ISBN 重複）はスキップ
    if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message)) {
      continue;
    }
    throw err;
  }
}

console.log(`Seed 完了: ${inserted} 件登録しました。`);
