import { randomUUID } from "node:crypto";
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

/** Books `resourceId` (or another resource) between two hours on 2026-12-01 UTC. */
function book(startHour: string, endHour: string, otherResourceId?: string) {
  return app.inject({
    method: "POST",
    url: "/bookings",
    payload: {
      resourceId: otherResourceId ?? resourceId,
      startsAt: `2026-12-01T${startHour}:00Z`,
      endsAt: `2026-12-01T${endHour}:00Z`,
    },
  });
}

describe("POST /bookings", () => {
  it("creates a booking and returns 201", async () => {
    const response = await book("10:00", "11:00");

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.any(String),
      resourceId,
      startsAt: "2026-12-01T10:00:00.000Z",
      endsAt: "2026-12-01T11:00:00.000Z",
      createdAt: expect.any(String),
    });
  });

  it("accepts any timezone and stores the same instant", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/bookings",
      payload: {
        resourceId,
        startsAt: "2026-12-01T07:00:00-03:00",
        endsAt: "2026-12-01T08:00:00-03:00",
      },
    });

    expect(response.json().startsAt).toBe("2026-12-01T10:00:00.000Z");
  });

  it("returns 404 when the resource does not exist", async () => {
    const response = await book("10:00", "11:00", randomUUID());

    expect(response.statusCode).toBe(404);
  });

  it("returns 400 when endsAt is not after startsAt", async () => {
    const response = await book("11:00", "10:00");

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ issues: [{ path: "endsAt" }] });
  });

  it("returns 400 when startsAt and endsAt are equal", async () => {
    const response = await book("10:00", "10:00");

    expect(response.statusCode).toBe(400);
  });

  it.each([
    ["has no timezone", "2026-12-01T10:00:00"],
    ["is not a date", "tomorrow"],
    ["is a number", 1764583200000],
  ])("returns 400 when startsAt %s", async (_case, startsAt) => {
    const response = await app.inject({
      method: "POST",
      url: "/bookings",
      payload: { resourceId, startsAt, endsAt: "2026-12-01T11:00:00Z" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ issues: [{ path: "startsAt" }] });
  });

  describe("overlap check (existing booking 10:00-12:00)", () => {
    beforeEach(async () => {
      expect((await book("10:00", "12:00")).statusCode).toBe(201);
    });

    it.each([
      ["the exact same slot", "10:00", "12:00"],
      ["overlaps the start", "09:00", "11:00"],
      ["overlaps the end", "11:00", "13:00"],
      ["is inside it", "10:30", "11:30"],
      ["contains it", "09:00", "13:00"],
    ])("returns 409 when the new booking %s", async (_case, start, end) => {
      const response = await book(start, end);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: "Conflict" });
    });

    it.each([
      ["ends exactly when it starts", "09:00", "10:00"],
      ["starts exactly when it ends", "12:00", "13:00"],
    ])("allows a booking that %s", async (_case, start, end) => {
      const response = await book(start, end);

      expect(response.statusCode).toBe(201);
    });

    it("allows the same slot on another resource", async () => {
      const other = await app.inject({
        method: "POST",
        url: "/resources",
        payload: { name: "Room B" },
      });

      const response = await book("10:00", "12:00", other.json().id);

      expect(response.statusCode).toBe(201);
    });
  });
});

describe("GET /resources/:id/bookings", () => {
  it("lists the bookings of a resource ordered by start time", async () => {
    await book("14:00", "15:00");
    await book("09:00", "10:00");

    const response = await app.inject({
      method: "GET",
      url: `/resources/${resourceId}/bookings`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((b: { startsAt: string }) => b.startsAt)).toEqual([
      "2026-12-01T09:00:00.000Z",
      "2026-12-01T14:00:00.000Z",
    ]);
  });

  it("returns 404 when the resource does not exist", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/resources/${randomUUID()}/bookings`,
    });

    expect(response.statusCode).toBe(404);
  });
});
