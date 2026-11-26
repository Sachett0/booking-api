import postgres from "postgres";
import { runMigrations } from "../migrate.ts";

/**
 * Runs once before the whole test suite.
 *
 * Drops everything in the test database and applies the migrations from
 * scratch, so every run starts from the same known state.
 */
export default async function setup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.includes("_test")) {
    // Safety net: never wipe a database that is not clearly a test one.
    throw new Error(`Refusing to reset a non-test database: ${databaseUrl}`);
  }

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`DROP SCHEMA public CASCADE`;
    await sql`CREATE SCHEMA public`;
    await runMigrations(sql);
  } finally {
    await sql.end();
  }
}
