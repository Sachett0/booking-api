import type { FastifyPluginAsync } from "fastify";
import type { Sql } from "../db.ts";
import { NotFoundError } from "../errors.ts";
import { createResourceRepository } from "./resource.repository.ts";
import { createResourceBody, resourceIdParams } from "./resource.schemas.ts";

export const resourceRoutes: FastifyPluginAsync<{ sql: Sql }> = async (app, { sql }) => {
  const resources = createResourceRepository(sql);

  app.post("/resources", async (request, reply) => {
    // parse() throws a ZodError on invalid input; the error handler turns it into a 400.
    const input = createResourceBody.parse(request.body);
    const resource = await resources.create(input);
    return reply.status(201).send(resource);
  });

  app.get("/resources", async () => {
    return resources.list();
  });

  app.get("/resources/:id", async (request) => {
    const { id } = resourceIdParams.parse(request.params);
    const resource = await resources.findById(id);
    if (!resource) {
      throw new NotFoundError(`Resource ${id} not found.`);
    }
    return resource;
  });
};
