import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { bootstrap } from "./db";
import { auth } from "./routes/auth";
import { shops } from "./routes/shops";
import { products } from "./routes/products";
import { tx } from "./routes/tx";
import { reports } from "./routes/reports";
import { seedChartOfAccounts } from "@khaodee/db/seed";
import { db } from "./db";

bootstrap();
await seedChartOfAccounts(db);

const app = new Hono();
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    credentials: true,
    allowHeaders: ["Content-Type", "X-Shop-Id"],
  }),
);

app.get("/health", (c) =>
  c.json({ ok: true, service: "khaodee", version: "0.1.0-dev" }),
);

app.route("/api/auth", auth);
app.route("/api/shops", shops);
app.route("/api/products", products);
app.route("/api/tx", tx);
app.route("/api/reports", reports);

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`khaodee server listening on http://localhost:${port}`);
});
