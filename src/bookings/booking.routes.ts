import type { FastifyPluginAsync } from "fastify";
import type { Sql } from "../db.ts";
import { NotFoundError } from "../errors.ts";
import { createResourceRepository } from "../resources/resource.repository.ts";
import { resourceIdParams } from "../resources/resource.schemas.ts";
import { createBookingRepository } from "./booking.repository.ts";
import { createBookingBody } from "./booking.schemas.ts";

export const bookingRoutes: FastifyPluginAsync<{ sql: Sql }> = async (app, { sql }) => {
  const bookings = createBookingRepository(sql);
  const resources = createResourceRepository(sql);

  app.post("/bookings", async (request, reply) => {
    const input = createBookingBody.parse(request.body);

    // No "does the resource exist?" or "is this slot free?" checks here on
    // purpose: create() does both safely inside one transaction (404 / 409).
    const booking = await bookings.create(input);
    return reply.status(201).send(booking);
  });

  app.get("/resources/:id/bookings", async (request) => {
    const { id } = resourceIdParams.parse(request.params);

    const resource = await resources.findById(id);
    if (!resource) {
      throw new NotFoundError(`Resource ${id} not found.`);
    }

    return bookings.listByResource(id);
  });
};
