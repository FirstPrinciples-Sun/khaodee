/** Drizzle Kit config — generates SQL migrations from packages/db/src/schema.ts. */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.KHAODEE_DB_PATH ?? "./data/khaodee.db",
  },
});
