import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { sql } from "../db.ts";

let app: ReturnType<typeof buildApp>;
let resourceId: string;

beforeEach(async () => {
  await sql`TRUNCATE resources CASCADE`;
  app = buildApp({ sql });

  const response = await app.inject({
    method: "POST",
    url: "/resources",
    payload: { name: "Room A" },
  });
  resourceId = response.json().id;
});

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await sql.end();
});

const CONCURRENT_REQUESTS = 10;

describe("POST /bookings under concurrent requests", () => {
  it("accepts exactly one of many simultaneous requests for the same slot", async () => {
    // Fire all requests at once, without waiting for one before the next.
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_REQUESTS }, () =>
        app.inject({
          method: "POST",
          url: "/bookings",
          payload: {
            resourceId,
            startsAt: "2026-12-01T10:00:00Z",
            endsAt: "2026-12-01T11:00:00Z",
          },
        }),
      ),
    );

    const statusCodes = responses.map((response) => response.statusCode).sort();
    expect(statusCodes).toEqual([201, ...Array(CONCURRENT_REQUESTS - 1).fill(409)]);

    // The database is the source of truth: exactly one booking was stored.
    const [row] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM bookings WHERE resource_id = ${resourceId}
    `;
    expect(row!.count).toBe(1);
  });

  it("accepts exactly one of many simultaneous overlapping requests", async () => {
    // Different but overlapping slots: 10:00-11:00, 10:05-11:05, 10:10-11:10...
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => {
        const start = new Date(Date.UTC(2026, 11, 1, 10, i * 5));
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        return app.inject({
          method: "POST",
          url: "/bookings",
          payload: { resourceId, startsAt: start.toISOString(), endsAt: end.toISOString() },
        });
      }),
    );

    const created = responses.filter((response) => response.statusCode === 201);
    expect(created).toHaveLength(1);
  });
});
