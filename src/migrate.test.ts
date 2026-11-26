import { afterAll, describe, expect, it } from "vitest";
import { sql } from "./db.ts";
import { runMigrations } from "./migrate.ts";

afterAll(async () => {
  await sql.end();
});

describe("database migrations", () => {
  it("creates the resources and bookings tables", async () => {
    // The camelCase transform in db.ts turns `table_name` into `tableName`.
    const rows = await sql<{ tableName: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    expect(rows.map((row) => row.tableName)).toEqual([
      "bookings",
      "resources",
      "schema_migrations",
    ]);
  });

  it("does nothing when run again", async () => {
    // The global setup already applied everything.
    expect(await runMigrations(sql)).toEqual([]);
  });

  it("rejects a booking that ends before it starts", async () => {
    const [resource] = await sql<{ id: string }[]>`
      INSERT INTO resources (name) VALUES ('Room A') RETURNING id
    `;

    const insertInvertedBooking = sql`
      INSERT INTO bookings (resource_id, starts_at, ends_at)
      VALUES (${resource!.id}, '2026-12-01T10:00:00Z', '2026-12-01T09:00:00Z')
    `;

    await expect(insertInvertedBooking).rejects.toMatchObject({
      constraint_name: "bookings_ends_after_starts",
    });
  });

  it("rejects overlapping bookings on the same resource, even via raw SQL", async () => {
    const [resource] = await sql<{ id: string }[]>`
      INSERT INTO resources (name) VALUES ('Room B') RETURNING id
    `;
    await sql`
      INSERT INTO bookings (resource_id, starts_at, ends_at)
      VALUES (${resource!.id}, '2026-12-01T10:00:00Z', '2026-12-01T12:00:00Z')
    `;

    const insertOverlapping = sql`
      INSERT INTO bookings (resource_id, starts_at, ends_at)
      VALUES (${resource!.id}, '2026-12-01T11:00:00Z', '2026-12-01T13:00:00Z')
    `;

    await expect(insertOverlapping).rejects.toMatchObject({
      code: "23P01",
      constraint_name: "bookings_no_overlap",
    });
  });
});
