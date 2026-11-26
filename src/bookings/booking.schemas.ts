import { z } from "zod";

/**
 * An ISO 8601 date-time WITH a timezone, e.g. "2026-12-01T10:00:00Z" or
 * "2026-12-01T07:00:00-03:00". Without the timezone, "10:00" would be
 * ambiguous: 10:00 where? So it is required.
 */
const dateTime = (field: string) =>
  z.iso
    .datetime({
      offset: true,
      error: `${field} must be an ISO 8601 date-time with a timezone.`,
    })
    .transform((value) => new Date(value));

/** Body of POST /bookings. */
export const createBookingBody = z
  .object({
    resourceId: z.uuid("Resource id must be a valid UUID."),
    startsAt: dateTime("startsAt"),
    endsAt: dateTime("endsAt"),
  })
  .refine((booking) => booking.endsAt > booking.startsAt, {
    message: "endsAt must be after startsAt.",
    path: ["endsAt"],
    // Only compare the dates when every field is valid. Otherwise an invalid
    // startsAt would also produce a misleading "endsAt must be after" issue.
    when: (payload) => payload.issues.length === 0,
  });
export type CreateBookingInput = z.infer<typeof createBookingBody>;

/** A booking as stored in the database and returned by the API. */
export interface Booking {
  id: string;
  resourceId: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}
