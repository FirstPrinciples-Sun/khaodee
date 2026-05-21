/**
 * Database connection + migrations bootstrap.
 *
 * Usage:
 *   import { openDb, runMigrations } from "@khaodee/db";
 *   const db = openDb();
 *   await runMigrations(db);
 */

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

export function openDb(path?: string): Db {
  const dbPath = path ?? process.env.KHAODEE_DB_PATH ?? "./data/khaodee.db";
  const abs = resolve(dbPath);
  mkdirSync(dirname(abs), { recursive: true });

  const sqlite = new Database(abs);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");

  return drizzle(sqlite, { schema });
}

export function runMigrations(db: Db, migrationsFolder?: string) {
  const folder = migrationsFolder ?? resolve(import.meta.dirname, "../migrations");
  migrate(db, { migrationsFolder: folder });
}

export { schema };
export * from "./schema";
