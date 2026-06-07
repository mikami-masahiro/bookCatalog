import { z } from "zod";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const bookInputSchema = z.object({
	isbn: z.string().trim().min(1).max(20).nullish(),
	title: z.string().trim().min(1).max(500),
	author: z.string().trim().max(500).nullish(),
	publisher: z.string().trim().max(500).nullish(),
	category: z.enum(["book", "magazine"]).default("book"),
	price: z.number().int().nonnegative().nullish(),
	release_date: z
		.string()
		.regex(DATE_RE, "release_date は YYYY-MM-DD 形式で指定してください"),
	description: z.string().trim().max(5000).nullish(),
});

export type BookInput = z.infer<typeof bookInputSchema>;

export const listQuerySchema = z.object({
	category: z.enum(["book", "magazine"]).optional(),
	publisher: z.string().trim().min(1).optional(), // 完全一致
	q: z.string().trim().min(1).optional(), // タイトル・著者名の部分一致
	from: z.string().regex(DATE_RE).optional(), // 発売日の下限（含む）
	to: z.string().regex(DATE_RE).optional(), // 発売日の上限（含む）
	limit: z.coerce.number().int().min(1).max(100).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
