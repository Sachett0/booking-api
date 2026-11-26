import Fastify, { type FastifyServerOptions } from "fastify";
import type { Sql } from "./db.ts";
import { registerErrorHandler } from "./errors.ts";

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
  const app = Fastify(options);

  registerErrorHandler(app);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  return app;
}
