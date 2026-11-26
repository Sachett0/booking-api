# booking-api

[![CI](https://github.com/Sachett0/booking-api/actions/workflows/ci.yml/badge.svg)](https://github.com/Sachett0/booking-api/actions/workflows/ci.yml)

A booking API that **never accepts two overlapping bookings for the same resource, even when the requests arrive at the same time**.

Built with Node.js 24, TypeScript, Fastify, PostgreSQL and Zod.

## Why this is harder than it looks

The obvious implementation is "check if the slot is free, then insert":

```
request A: SELECT → slot is free
request B: SELECT → slot is free
request A: INSERT ✔
request B: INSERT ✔   ← double booking
```

Both requests pass the check before either one inserts. A test in this repo fires 10 simultaneous requests for the same slot. With the check in application code, **all 10 were accepted**.

### How this API prevents it

Two layers, in [`booking.repository.ts`](src/bookings/booking.repository.ts) and [migration 002](migrations/002_prevent_overlapping_bookings.sql):

1. **An exclusion constraint in PostgreSQL**, the actual guarantee:

   ```sql
   EXCLUDE USING gist (
     resource_id WITH =,
     tstzrange(starts_at, ends_at, '[)') WITH &&
   )
   ```

   The database refuses any row with the same resource and an overlapping time range, atomically, no matter where the insert comes from. A violation becomes `409 Conflict`.

2. **A row lock on the resource** (`SELECT ... FOR UPDATE`) inside the insert transaction, so bookings for the same resource are processed one at a time. Bookings for different resources do not wait for each other.

   The constraint alone keeps the data correct, but concurrent inserts can **deadlock** inside the constraint check. In about half of the test runs, PostgreSQL resolved the deadlock after ~9 s and 9 of 10 requests failed with `500` instead of `409`. The lock removes the deadlock: the test suite then passed 15 runs in a row.

Time ranges are end-exclusive (`[start, end)`), so `10:00–11:00` and `11:00–12:00` do not conflict.

## Quick start

Requirements: Node.js 22.18+ (24 recommended) and Docker.

```powershell
npm install
copy .env.example .env      # on macOS/Linux: cp .env.example .env
npm run db:up               # starts PostgreSQL in Docker
npm run db:migrate          # creates the tables
npm run dev                 # http://localhost:3333
```

Try it (PowerShell):

```powershell
Invoke-RestMethod -Method Post http://localhost:3333/resources -ContentType "application/json" -Body '{"name":"Room A"}'
```

Or with curl (macOS/Linux):

```bash
curl -X POST localhost:3333/resources -H "content-type: application/json" -d '{"name":"Room A"}'
```

## API

| Method | Route | Success | Errors |
|---|---|---|---|
| `GET` | `/health` | `200` | — |
| `POST` | `/resources` | `201` | `400` |
| `GET` | `/resources` | `200` | — |
| `GET` | `/resources/:id` | `200` | `400`, `404` |
| `POST` | `/bookings` | `201` | `400`, `404`, `409` |
| `GET` | `/resources/:id/bookings` | `200` | `400`, `404` |

Creating a booking:

```http
POST /bookings
Content-Type: application/json

{
  "resourceId": "0105f3cb-c999-42d7-9034-6823095bf107",
  "startsAt": "2026-12-01T10:00:00Z",
  "endsAt": "2026-12-01T11:00:00Z"
}
```

Dates must be ISO 8601 **with a timezone** (`Z` or `-03:00`). Without one, `10:00` would be ambiguous.

### Errors

Every error has the same shape:

```json
{
  "error": "ValidationError",
  "message": "Request data is invalid.",
  "issues": [{ "path": "endsAt", "message": "endsAt must be after startsAt." }]
}
```

| `error` | Status | When |
|---|---|---|
| `ValidationError` | 400 | Invalid input (includes `issues`) |
| `BadRequest` | 400 | Malformed JSON |
| `UnsupportedMediaType` | 415 | Body is not JSON |
| `NotFound` | 404 | Unknown route or record |
| `Conflict` | 409 | Time slot already booked |
| `InternalServerError` | 500 | Anything unexpected |

Clients should branch on `error`, which is stable, not on `message`. Unexpected errors never expose internals: the client gets a generic message and a `requestId`, and the full error is logged on the server under the same id.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the API and restarts it on file changes |
| `npm start` | Starts the API |
| `npm test` | Runs the tests (needs `npm run db:up`) |
| `npm run test:watch` | Runs the tests on every change |
| `npm run typecheck` | Checks types with `tsc` |
| `npm run db:up` / `db:down` | Starts / stops PostgreSQL |
| `npm run db:migrate` | Applies pending migrations |

## Tests

Tests run against a real PostgreSQL, in a separate `booking_test` database that is reset at the start of every run. They cover validation, every overlap shape (same slot, overlapping start or end, inside, containing, back-to-back), error responses and **concurrent requests**.

## Docker

The API runs as TypeScript directly on Node 24 (type stripping), so the image has no build step and no dev dependencies.

```powershell
docker build -t booking-api .
docker run --rm -e DATABASE_URL=postgres://user:pass@host:5432/booking booking-api node src/scripts/migrate.ts
docker run -p 3333:3333 -e DATABASE_URL=postgres://user:pass@host:5432/booking booking-api
```

## Project structure

```
migrations/            SQL migrations, applied in filename order
src/
  app.ts               builds the Fastify app (no network), used by server and tests
  server.ts            starts the HTTP server and handles graceful shutdown
  config.ts            reads and validates environment variables
  db.ts                PostgreSQL connection pool
  errors.ts            error classes and the single error response format
  migrate.ts           migration runner
  resources/           resources: schemas, repository (SQL), routes, tests
  bookings/            bookings: schemas, repository (SQL), routes, tests
```

Routes validate input with Zod and call a repository. Repositories hold all the SQL.

## CI

GitHub Actions runs the typecheck and the tests against a PostgreSQL service, and builds the Docker image, on every pull request and on every push to `main`.
