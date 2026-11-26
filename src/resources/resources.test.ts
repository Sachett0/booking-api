import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { sql } from "../db.ts";

let app: ReturnType<typeof buildApp>;

beforeEach(async () => {
  // Start every test with empty tables (CASCADE also clears bookings).
  await sql`TRUNCATE resources CASCADE`;
  app = buildApp({ sql });
});

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await sql.end();
});

function createResource(name: unknown) {
  return app.inject({ method: "POST", url: "/resources", payload: { name } });
}

describe("POST /resources", () => {
  it("creates a resource and returns 201", async () => {
    const response = await createResource("Room A");

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.any(String),
      name: "Room A",
      createdAt: expect.any(String),
    });
  });

  it("trims spaces around the name", async () => {
    const response = await createResource("   Room B   ");

    expect(response.json().name).toBe("Room B");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["only spaces", "   "],
    ["not a string", 42],
    ["too long", "x".repeat(101)],
  ])("returns 400 when the name is %s", async (_case, name) => {
    const response = await createResource(name);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ValidationError",
      issues: [{ path: "name" }],
    });
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/resources",
      headers: { "content-type": "application/json" },
      payload: "{ not json",
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("GET /resources", () => {
  it("returns an empty list when there are no resources", async () => {
    const response = await app.inject({ method: "GET", url: "/resources" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("lists resources in creation order", async () => {
    await createResource("Room A");
    await createResource("Room B");

    const response = await app.inject({ method: "GET", url: "/resources" });

    expect(response.json().map((r: { name: string }) => r.name)).toEqual(["Room A", "Room B"]);
  });
});

describe("GET /resources/:id", () => {
  it("returns the resource", async () => {
    const created = (await createResource("Room A")).json();

    const response = await app.inject({ method: "GET", url: `/resources/${created.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(created);
  });

  it("returns 404 when the resource does not exist", async () => {
    const response = await app.inject({ method: "GET", url: `/resources/${randomUUID()}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "NotFound" });
  });

  it("returns 400 when the id is not a UUID", async () => {
    const response = await app.inject({ method: "GET", url: "/resources/abc" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ issues: [{ path: "id" }] });
  });
});
