import { test } from "node:test";
import assert from "node:assert/strict";
import { mapRecordToBook } from "../src/services/openbd.js";

const record = {
	summary: {
		isbn: "9784101010014",
		title: "こころ",
		author: "夏目漱石／著",
		publisher: "新潮社",
		pubdate: "20040101",
	},
	onix: {
		DescriptiveDetail: {
			Subject: [
				{ SubjectSchemeIdentifier: "20", SubjectHeadingText: "キーワード" },
				{ SubjectSchemeIdentifier: "78", SubjectCode: "0093" },
			],
		},
		CollateralDetail: {
			TextContent: [{ TextType: "03", Text: "あらすじ。" }],
		},
		ProductSupply: {
			SupplyDetail: {
				Price: [{ PriceType: "03", PriceAmount: "539", CurrencyCode: "JPY" }],
			},
		},
	},
};

test("OpenBD レコードを Book 形状に変換する", () => {
	const book = mapRecordToBook(record, "9784101010014");
	assert.equal(book.isbn, "9784101010014");
	assert.equal(book.title, "こころ");
	assert.equal(book.author, "夏目漱石／著");
	assert.equal(book.publisher, "新潮社");
	assert.equal(book.category, "0093");
	assert.equal(book.price, 539);
	assert.equal(book.description, "あらすじ。");
	assert.equal(book.release_date, Math.floor(Date.UTC(2004, 0, 1) / 1000));
	assert.equal(typeof book.created_at, "number");
});

test("pubdate が年のみでも変換できる", () => {
	const book = mapRecordToBook({ summary: { pubdate: "2004" } }, "x");
	assert.equal(book.release_date, Math.floor(Date.UTC(2004, 0, 1) / 1000));
});

test("価格・内容が無い場合は null", () => {
	const book = mapRecordToBook({ summary: { title: "無" } }, "x");
	assert.equal(book.price, null);
	assert.equal(book.description, null);
});

test("C コードが無い場合は category が null", () => {
	const book = mapRecordToBook({ summary: { title: "無" } }, "x");
	assert.equal(book.category, null);
});
