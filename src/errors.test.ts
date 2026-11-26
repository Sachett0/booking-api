import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { sql } from "./db.ts";

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  app = buildApp({ sql });
  // A route that fails the way a bug or a database error would.
  app.get("/test/boom", async () => {
    throw new Error('relation "secret_table" does not exist');
  });
});

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await sql.end();
});

describe("error responses", () => {
  it("hides the details of unexpected errors behind a generic 500", async () => {
    const response = await app.inject({ method: "GET", url: "/test/boom" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "InternalServerError",
      message: "An unexpected error occurred.",
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(response.body).not.toContain("secret_table");
  });

  it("gives each request a different id", async () => {
    const first = await app.inject({ method: "GET", url: "/test/boom" });
    const second = await app.inject({ method: "GET", url: "/test/boom" });

    expect(first.json().requestId).not.toBe(second.json().requestId);
  });

  it("uses the standard format for unknown routes", async () => {
    const response = await app.inject({ method: "GET", url: "/does-not-exist" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "NotFound",
      message: "Route GET /does-not-exist not found.",
    });
  });

  it("uses the standard format for malformed JSON", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/resources",
      headers: { "content-type": "application/json" },
      payload: "{ not json",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "BadRequest",
      message: expect.any(String),
    });
  });

  it("uses the standard format for unsupported content types", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/resources",
      headers: { "content-type": "application/xml" },
      payload: "<name>Room A</name>",
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toEqual({
      error: "UnsupportedMediaType",
      message: expect.any(String),
    });
  });
});
