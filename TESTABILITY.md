## Testability Issues Found

### backend/src/app.ts

**Problem**: `reminderRoutes` is mounted twice — once at `/api/vehicles` and again at `/api`. Because `reminderRoutes` applies `router.use(authenticateToken)` as its first middleware, mounting it at `/api` causes the authentication guard to run for _every_ request whose path starts with `/api`, including routes in subsequently-mounted routers (`fuelPricesRoutes`, `resalePackRoutes`). This makes it impossible to test the fuel-prices and resale-pack routes without a valid JWT, even though their own route handlers are documented as requiring no authentication.

The symptom observed during testing: `POST /api/fuel-prices/nearby` without an `Authorization` header returns `401 Unauthorized` rather than the expected `400` for invalid input.

**Recommendation for backend-dev**:

- Remove the duplicate `app.use('/api', reminderRoutes)` line (line 48). The reminder routes that belong under a vehicle context are already mounted at `app.use('/api/vehicles', reminderRoutes)`. If standalone reminder routes (i.e. `GET /api/reminders`) are needed at the `/api` prefix, extract only those routes into a dedicated `apiRemindersRoutes` file with its own `router.use(authenticateToken)` guard, so the auth scope is limited to that router only.
- Alternatively, move the `authenticateToken` middleware from `router.use(...)` (which applies to all paths entering the router) onto each individual route handler, so that unauthenticated routes in the same router are not accidentally blocked.

### backend/src/routes/fuelPrices.ts — in-memory cache isolation

**Problem**: `priceCache` and `geocodeCache` are `Map` instances at module scope. They persist for the lifetime of the Vitest worker process, which means cache state leaks between tests. A test that expects the gov.uk feed to be unavailable (503) will silently receive cached data from an earlier test that succeeded, making the test pass for the wrong reason.

**Recommendation for backend-dev** (already addressed in the current codebase):

The `clearCachesForTesting()` export added to `fuelPrices.ts` solves this correctly. This is the right pattern for module-level caches that need to be reset between tests. No further action required — this recommendation is kept for documentation purposes.
