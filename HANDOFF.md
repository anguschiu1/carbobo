# HANDOFF.md — Backend changes requiring frontend coordination

## Change set: 2026-04-05

---

### 1. `tank_size_litres` added to Vehicle

**What changed (backend):**
- New column `tank_size_litres INTEGER NOT NULL DEFAULT 50` on the `vehicles` table.
- Shared type `Vehicle` in `shared/src/types/index.ts` has a new optional field:
  ```ts
  tank_size_litres?: number  // default 50 if not set
  ```
- All vehicle GET, POST, and PUT responses now include `tank_size_litres` in the JSON.

**What frontend-dev needs to do:**

1. **`VehicleForm.vue`** — Add an optional numeric input for "Tank size (litres)" in the create/edit form.
   - Default value: `50`
   - Reasonable validation: integer between 10 and 200.
   - Send it as `tank_size_litres` in the POST/PUT request body.

2. **`FuelPrices.vue`** — Replace the hardcoded `50` litre constant used for per-tank cost estimates with `vehicle.tank_size_litres ?? 50` from the currently selected vehicle.

3. **Type usage** — The `Vehicle` interface imported from `@carbobo/shared` already has `tank_size_litres?: number`. No manual type changes needed in the frontend.

---

### 2. Rate limiting on `POST /api/fuel-prices/nearby`

**What changed (backend):**
- The endpoint now returns HTTP `429` when a single IP exceeds 30 requests per minute.
- Response body on rate limit:
  ```json
  { "error": "Too many requests. Please wait before searching again." }
  ```
- Standard rate-limit headers (`RateLimit-*`) are included in every response from this endpoint.

**What frontend-dev needs to do:**

1. **`FuelPrices.vue`** — Handle HTTP 429 from `POST /api/fuel-prices/nearby`.
   - Show a user-friendly message such as: "Too many searches. Please wait a moment before trying again."
   - Disable the search button briefly after a 429 response to prevent immediate retries.

---

### Existing DB migration note (for staging/production environments)

The `vehicles` table has a new column that does not exist in any previously created database. For any database that was created before this change, run:

```sql
ALTER TABLE vehicles ADD COLUMN tank_size_litres INTEGER NOT NULL DEFAULT 50;
```

The dev database is auto-created on first run from the schema in `backend/src/db/index.ts`, so this ALTER TABLE is only needed for pre-existing databases (staging, production).
