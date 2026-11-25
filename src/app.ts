import Fastify, { type FastifyServerOptions } from "fastify";

/**
 * Builds the application but does NOT start listening.
 *
 * Keeping "build" (app.ts) apart from "start" (server.ts) lets tests create
 * the app and send requests straight to it, without opening a network port.
 */
export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  return app;
}
