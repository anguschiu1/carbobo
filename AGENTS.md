# Carbobo - UK Car Health Coach + Fuel Saver

## Cursor Cloud specific instructions

### Project overview

pnpm workspace monorepo with three packages: `frontend` (Vue 3 + Vite), `backend` (Express.js + SQLite), and `shared` (TypeScript types). See `README.md` for full setup and commands.

### Running services

- **Backend** (port 3000): `pnpm --filter backend dev` — Express API with SQLite (auto-created `carbobo.db`).
- **Frontend** (port 5173): `pnpm --filter frontend dev` — Vite dev server; proxies `/api` to `:3000`.
- **Both**: `pnpm dev` (runs them in parallel via `&`).

### Non-obvious caveats

- The `shared` package **must be built before** the frontend or backend can compile. Run `pnpm --filter @carbobo/shared build` first, or just `pnpm build` which handles the order.
- `pnpm.onlyBuiltDependencies` in root `package.json` allowlists `bcrypt` and `better-sqlite3` for native builds. Do not run `pnpm approve-builds` interactively.
- Backend `.env` requires `JWT_SECRET` to be set (any non-empty string). Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env` before first run.
- The `Price (pence/L)` field in fuel entry expects pence (e.g. `145` for £1.45/L), not pounds — entering `1.45` will show a cost mismatch warning but the entry still saves.
- No dedicated linter (ESLint) is configured. Type checking is done via `vue-tsc -b` (frontend build) and `tsc` (backend/shared build).

### Testing

- **Backend tests**: `pnpm --filter backend test` (Vitest + supertest, in-memory SQLite)
- **Frontend tests**: `pnpm --filter frontend test -- --run` (Vitest + @vue/test-utils, jsdom)
- Both test suites run from repo root; no additional setup needed beyond `pnpm install`.
