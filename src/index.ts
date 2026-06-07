import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { db } from "./db/index.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp(db);

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`Book Catalog API listening on http://localhost:${info.port}`);
});
