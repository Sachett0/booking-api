import { readdir, readFile } from "node:fs/promises";
import type { Sql } from "./db.ts";

const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url);

// Any fixed number works; it just has to be the same for every migrator.
const MIGRATION_LOCK_ID = 727_001;

/**
 * Applies every `migrations/*.sql` file that has not been applied yet,
 * in filename order, and returns the names of the files it applied.
 *
 * - Everything runs in a single transaction: if any file fails, none is applied.
 * - Applied files are recorded in `schema_migrations`, so running this twice is safe.
 * - An advisory lock stops two processes from migrating at the same time.
 */
export async function runMigrations(sql: Sql): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_ID})`;

    await tx`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text        PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    const rows = await tx<{ name: string }[]>`SELECT name FROM schema_migrations`;
    const alreadyApplied = new Set(rows.map((row) => row.name));

    const applied: string[] = [];
    for (const file of files) {
      if (alreadyApplied.has(file)) continue;

      const content = await readFile(new URL(file, MIGRATIONS_DIR), "utf8");
      // unsafe() runs raw SQL text. Fine here: the content is our own file,
      // never user input.
      await tx.unsafe(content);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
      applied.push(file);
    }
    return applied;
  });
}
