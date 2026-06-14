export interface Book {
	id: number;
	isbn: string | null; // 雑誌など ISBN を持たない刊行物は null
	title: string;
	author: string | null;
	publisher: string | null;
	category: string | null; // 生の C コード（4 桁。例 "0093"）。不明な場合は null
	price: number | null; // 税込・円
	release_date: number; // UNIX time（秒）
	description: string | null;
	created_at: number; // UNIX time（秒）
	updated_at: number; // UNIX time（秒）
}
