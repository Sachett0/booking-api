import { sql } from "../db.ts";
import { runMigrations } from "../migrate.ts";

try {
  const applied = await runMigrations(sql);
  if (applied.length === 0) {
    console.log("Database is up to date.");
  } else {
    for (const name of applied) console.log(`Applied ${name}`);
  }
} catch (error) {
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
