import postgres from "postgres";
import { config } from "./config.ts";

/**
 * A single connection pool shared by the whole app.
 *
 * `postgres` opens connections lazily (on the first query) and reuses them,
 * so importing this module does not touch the network by itself.
 */
export const sql = postgres(config.databaseUrl, {
  max: 10,
  // Silence NOTICE messages such as "relation already exists, skipping".
  onnotice: () => {},
});

export type Sql = typeof sql;
