import { Hono } from "hono";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";

const app = new Hono();
app.use("*", logger());

app.get("/health", (c) => c.json({ ok: true, service: "khaodee", version: "0.1.0-dev" }));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`khaodee server listening on http://localhost:${port}`);
});
