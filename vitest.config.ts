import { defineConfig } from "vitest/config";

// Tests always use their own database, never the development one.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://booking:booking@localhost:5432/booking_test";

// `test.env` only reaches the test files. The global setup runs in this
// process, so it needs the variable set here as well.
process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  test: {
    env: { DATABASE_URL: testDatabaseUrl },
    // Runs once before all test files: resets the test database schema.
    globalSetup: ["./src/test/global-setup.ts"],
  },
});
