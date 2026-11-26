import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

/** Thrown when a requested record does not exist. Becomes a 404 response. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Turns known errors into clear JSON responses.
 *
 * Anything not handled here falls back to Fastify's default handler, which
 * keeps the status code of its own errors (e.g. 400 for malformed JSON) and
 * answers 500 for unexpected ones without leaking internal details.
 */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Request data is invalid.",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    if (error instanceof NotFoundError) {
      return reply.status(404).send({
        error: "NotFound",
        message: error.message,
      });
    }

    throw error;
  });
}
