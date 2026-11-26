/**
 * Reads and validates environment variables once, at startup.
 *
 * Failing fast here is better than discovering a typo in DATABASE_URL
 * only when the first request hits the database.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: "${raw}"`);
  }
  return port;
}

export const config = {
  port: parsePort(process.env.PORT, 3333),
  databaseUrl: requireEnv("DATABASE_URL"),
};
