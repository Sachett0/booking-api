import type { Sql } from "../db.ts";
import type { CreateResourceInput, Resource } from "./resource.schemas.ts";

/**
 * All SQL for resources lives here. Routes call these functions and never
 * write SQL themselves, so the HTTP layer and the database layer stay apart.
 */
export function createResourceRepository(sql: Sql) {
  return {
    async create(input: CreateResourceInput): Promise<Resource> {
      const [resource] = await sql<Resource[]>`
        INSERT INTO resources (name)
        VALUES (${input.name})
        RETURNING id, name, created_at
      `;
      // INSERT ... RETURNING always yields exactly one row.
      return resource!;
    },

    async list(): Promise<Resource[]> {
      return sql<Resource[]>`
        SELECT id, name, created_at
        FROM resources
        ORDER BY created_at, id
      `;
    },

    async findById(id: string): Promise<Resource | undefined> {
      const [resource] = await sql<Resource[]>`
        SELECT id, name, created_at
        FROM resources
        WHERE id = ${id}
      `;
      return resource;
    },
  };
}
