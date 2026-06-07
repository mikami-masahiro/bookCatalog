export type Category = "book" | "magazine";

export interface Book {
	id: number;
	isbn: string | null; // 雑誌など ISBN を持たない刊行物は null
	title: string;
	author: string | null;
	publisher: string | null;
	category: Category;
	price: number | null; // 税込・円
	release_date: string; // YYYY-MM-DD
	description: string | null;
	created_at: string;
	updated_at: string;
}
