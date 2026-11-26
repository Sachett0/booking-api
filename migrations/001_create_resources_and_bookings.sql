-- Something that can be booked: a room, a court, a professional's agenda...
CREATE TABLE resources (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A time slot reserved on a resource.
-- Note: nothing here prevents two overlapping bookings yet. That guarantee
-- comes in step 6, with an exclusion constraint.
CREATE TABLE bookings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid        NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_ends_after_starts CHECK (ends_at > starts_at)
);

-- Speeds up "bookings of resource X", the most common lookup.
CREATE INDEX bookings_resource_id_idx ON bookings (resource_id);
