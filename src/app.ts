import { randomUUID } from "node:crypto";
import Fastify, { type FastifyServerOptions } from "fastify";
import { bookingRoutes } from "./bookings/booking.routes.ts";
import type { Sql } from "./db.ts";
import { registerErrorHandler } from "./errors.ts";
import { resourceRoutes } from "./resources/resource.routes.ts";

/** What the app needs from the outside world. */
export interface AppDependencies {
  sql: Sql;
}

/**
 * Builds the application but does NOT start listening.
 *
 * Keeping "build" (app.ts) apart from "start" (server.ts) lets tests create
 * the app and send requests straight to it, without opening a network port.
 *
 * The database is passed in instead of imported, so the caller decides which
 * one is used: the real one in server.ts, the test one in tests.
 */
export function buildApp(deps: AppDependencies, options: FastifyServerOptions = {}) {
  const app = Fastify({
    // A unique id per request, shown in logs and in 500 responses, so a
    // user's error report can be matched to the server log entry.
    genReqId: () => randomUUID(),
    ...options,
  });

  registerErrorHandler(app);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.register(resourceRoutes, { sql: deps.sql });
  app.register(bookingRoutes, { sql: deps.sql });

  return app;
}
