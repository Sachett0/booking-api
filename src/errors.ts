import { STATUS_CODES } from "node:http";
import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";

/** Thrown when a requested record does not exist. Becomes a 404 response. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Thrown when a request clashes with the current state, such as a time slot
 * that is already taken. Becomes a 409 response.
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/**
 * The single shape of every error response of this API.
 *
 * - `error`: a stable, machine-readable name. Clients branch on this.
 * - `message`: a human-readable explanation. It may change; never parse it.
 * - `issues`: only on validation errors, one entry per invalid field.
 * - `requestId`: only on 500s, to find the matching entry in the server logs.
 */
export interface ErrorResponse {
  error: string;
  message: string;
  issues?: { path: string; message: string }[];
  requestId?: string;
}

function sendError(reply: FastifyReply, status: number, body: ErrorResponse) {
  return reply.status(status).send(body);
}

/** 404 -> "NotFound", 415 -> "UnsupportedMediaType", etc. */
function errorNameFor(status: number): string {
  return (STATUS_CODES[status] ?? "Error").replace(/[^a-zA-Z]/g, "");
}

/** Errors created by Fastify itself (malformed JSON, body too large...) carry a 4xx statusCode. */
function clientStatusOf(error: unknown): number | undefined {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" && status >= 400 && status < 500 ? status : undefined;
}

/**
 * Turns every error into an `ErrorResponse`.
 *
 * Known errors keep their message, because we wrote it for the client.
 * Unexpected errors (bugs, database failures...) are logged in full on the
 * server, but the client only gets a generic 500: their messages can reveal
 * table names, queries or other internals.
 */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return sendError(reply, 400, {
        error: "ValidationError",
        message: "Request data is invalid.",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    if (error instanceof NotFoundError) {
      return sendError(reply, 404, { error: "NotFound", message: error.message });
    }

    if (error instanceof ConflictError) {
      return sendError(reply, 409, { error: "Conflict", message: error.message });
    }

    const clientStatus = clientStatusOf(error);
    if (clientStatus) {
      return sendError(reply, clientStatus, {
        error: errorNameFor(clientStatus),
        message: (error as Error).message,
      });
    }

    request.log.error({ err: error }, "Unhandled error");
    return sendError(reply, 500, {
      error: "InternalServerError",
      message: "An unexpected error occurred.",
      requestId: request.id,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return sendError(reply, 404, {
      error: "NotFound",
      message: `Route ${request.method} ${request.url} not found.`,
    });
  });
}
