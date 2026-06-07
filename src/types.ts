/** 新刊情報の区分 */
export type Category = "book" | "magazine";

/** books テーブルの 1 レコードに対応する型 */
export interface Book {
  id: number;
  /** ISBN（雑誌など存在しない場合は null） */
  isbn: string | null;
  /** タイトル */
  title: string;
  /** 著者名 */
  author: string | null;
  /** 出版社名 */
  publisher: string | null;
  /** 区分（書籍 / 雑誌） */
  category: Category;
  /** 税込価格（円）。不明な場合は null */
  price: number | null;
  /** 発売日（YYYY-MM-DD） */
  release_date: string;
  /** 内容紹介 */
  description: string | null;
  created_at: string;
  updated_at: string;
}
