import { writeFileSync } from "node:fs";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db/index.js";

// クライアントのコード生成（openapi-typescript）入力となる openapi.json を書き出す。
// DB には触れないため :memory: で十分。
const app = createApp(createDatabase(":memory:"));

const doc = app.getOpenAPIDocument({
	openapi: "3.0.0",
	info: { title: "Book Catalog API", version: "0.1.0" },
});

const out = new URL("../openapi.json", import.meta.url);
writeFileSync(out, JSON.stringify(doc, null, "\t") + "\n");
console.log(`openapi.json を生成しました: ${out.pathname}`);
