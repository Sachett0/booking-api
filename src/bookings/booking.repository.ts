import type { Sql } from "../db.ts";
import type { Booking, CreateBookingInput } from "./booking.schemas.ts";

export function createBookingRepository(sql: Sql) {
  return {
    async create(input: CreateBookingInput): Promise<Booking> {
      const [booking] = await sql<Booking[]>`
        INSERT INTO bookings (resource_id, starts_at, ends_at)
        VALUES (${input.resourceId}, ${input.startsAt}, ${input.endsAt})
        RETURNING id, resource_id, starts_at, ends_at, created_at
      `;
      return booking!;
    },

    /**
     * Is there any booking on this resource that overlaps [startsAt, endsAt)?
     *
     * Two intervals overlap when each one starts before the other ends.
     * Using "<" (not "<=") makes the end exclusive, so back-to-back bookings
     * such as 10:00-11:00 and 11:00-12:00 do NOT count as overlapping.
     */
    async hasOverlap(input: CreateBookingInput): Promise<boolean> {
      const [row] = await sql<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM bookings
          WHERE resource_id = ${input.resourceId}
            AND starts_at < ${input.endsAt}
            AND ends_at > ${input.startsAt}
        ) AS exists
      `;
      return row!.exists;
    },

    async listByResource(resourceId: string): Promise<Booking[]> {
      return sql<Booking[]>`
        SELECT id, resource_id, starts_at, ends_at, created_at
        FROM bookings
        WHERE resource_id = ${resourceId}
        ORDER BY starts_at
      `;
    },
  };
}
