import { z } from "zod";

/** Body of POST /resources. */
export const createResourceBody = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
});
export type CreateResourceInput = z.infer<typeof createResourceBody>;

/** URL params of GET /resources/:id. */
export const resourceIdParams = z.object({
  id: z.uuid("Resource id must be a valid UUID."),
});

/** A resource as stored in the database and returned by the API. */
export interface Resource {
  id: string;
  name: string;
  createdAt: Date;
}
