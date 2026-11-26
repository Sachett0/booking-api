import type { FastifyPluginAsync } from "fastify";
import type { Sql } from "../db.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import { createResourceRepository } from "../resources/resource.repository.ts";
import { resourceIdParams } from "../resources/resource.schemas.ts";
import { createBookingRepository } from "./booking.repository.ts";
import { createBookingBody } from "./booking.schemas.ts";

export const bookingRoutes: FastifyPluginAsync<{ sql: Sql }> = async (app, { sql }) => {
  const bookings = createBookingRepository(sql);
  const resources = createResourceRepository(sql);

  app.post("/bookings", async (request, reply) => {
    const input = createBookingBody.parse(request.body);

    const resource = await resources.findById(input.resourceId);
    if (!resource) {
      throw new NotFoundError(`Resource ${input.resourceId} not found.`);
    }

    // WARNING: "check, then insert" has a race condition. Two requests that
    // arrive at the same time can both pass this check before either one
    // inserts, and both get saved. Step 6 proves it and fixes it.
    if (await bookings.hasOverlap(input)) {
      throw new ConflictError("This time slot is already booked for this resource.");
    }

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
