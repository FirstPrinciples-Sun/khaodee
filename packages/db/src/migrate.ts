/** CLI entry: apply Drizzle migrations + seed COA. */
import { openDb, runMigrations } from "./index";
import { seedChartOfAccounts } from "./seed";

const db = openDb();
runMigrations(db);
await seedChartOfAccounts(db);
console.log("migrations applied + Thai COA seeded");
