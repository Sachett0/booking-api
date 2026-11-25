import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";

describe("GET /health", () => {
  let app: ReturnType<typeof buildApp>;

  // Each test gets a fresh app so tests never share state.
  beforeEach(() => {
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 200 with status ok", async () => {
    // inject() simulates the request in memory: no network port is opened.
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns 404 for an unknown route", async () => {
    const response = await app.inject({ method: "GET", url: "/does-not-exist" });

    expect(response.statusCode).toBe(404);
  });
});
