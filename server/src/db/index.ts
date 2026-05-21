import { openDb as openDbFromPkg, runMigrations as runMigrationsFromPkg, schema } from "@khaodee/db";

export const db = openDbFromPkg();

export function bootstrap() {
  runMigrationsFromPkg(db);
}

export { schema };
