-- Makes the DATABASE refuse overlapping bookings on the same resource.
--
-- Checking for overlaps in application code ("SELECT, then INSERT") is not
-- enough: two concurrent requests can both see the slot as free and both
-- insert. An exclusion constraint is checked by PostgreSQL itself, atomically,
-- so no combination of concurrent requests can break it.

-- btree_gist lets a GiST index compare plain values with "=" (resource_id),
-- alongside the range comparison below.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    -- Same resource...
    resource_id WITH =,
    -- ...and overlapping time ranges ("&&" means "overlaps").
    -- '[)' includes the start and excludes the end, so 10:00-11:00 and
    -- 11:00-12:00 do not overlap, matching the API's rule.
    tstzrange(starts_at, ends_at, '[)') WITH &&
  );

-- The GiST index created by the constraint also serves lookups by
-- resource_id, so the old B-tree index is no longer needed.
DROP INDEX bookings_resource_id_idx;
