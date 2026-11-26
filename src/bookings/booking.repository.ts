import postgres from "postgres";
import type { Sql } from "../db.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import type { Booking, CreateBookingInput } from "./booking.schemas.ts";

// PostgreSQL error code: https://www.postgresql.org/docs/current/errcodes-appendix.html
const EXCLUSION_VIOLATION = "23P01";

export function createBookingRepository(sql: Sql) {
  return {
    /**
     * Inserts a booking, guaranteeing that no two bookings of the same
     * resource overlap, even when many requests arrive at the same time.
     *
     * Two layers work together:
     *
     * 1. `SELECT ... FOR UPDATE` locks the resource row until the transaction
     *    ends. Concurrent bookings for the SAME resource therefore run one at
     *    a time; bookings for different resources are not affected.
     *    Without this, concurrent inserts can deadlock inside the exclusion
     *    constraint check, and PostgreSQL aborts them after a delay.
     *
     * 2. The exclusion constraint `bookings_no_overlap` (migration 002) is the
     *    actual guarantee: the database refuses any overlapping row, no matter
     *    where it comes from. Its violation becomes a 409.
     */
    async create(input: CreateBookingInput): Promise<Booking> {
      try {
        return await sql.begin(async (tx) => {
          const [resource] = await tx`
            SELECT id FROM resources WHERE id = ${input.resourceId} FOR UPDATE
          `;
          if (!resource) {
            throw new NotFoundError(`Resource ${input.resourceId} not found.`);
          }

          const [booking] = await tx<Booking[]>`
            INSERT INTO bookings (resource_id, starts_at, ends_at)
            VALUES (${input.resourceId}, ${input.startsAt}, ${input.endsAt})
            RETURNING id, resource_id, starts_at, ends_at, created_at
          `;
          return booking!;
        });
      } catch (error) {
        if (
          error instanceof postgres.PostgresError &&
          error.code === EXCLUSION_VIOLATION &&
          error.constraint_name === "bookings_no_overlap"
        ) {
          throw new ConflictError("This time slot is already booked for this resource.");
        }
        throw error;
      }
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
