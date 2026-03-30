# CLAUDE.md — Carbobo Codebase Guide

## Project Overview

**Carbobo** is a mobile-first web application for UK car owners to track vehicle maintenance, fuel consumption, and generate resale evidence packs. It is a "Car Health Coach + Fuel Saver" targeting cost-conscious drivers who want documented service history to improve resale value.

**MVP v1 is complete** (as of Feb 2026). The codebase is clean, stable, and production-ready for development purposes.

---

## Repository Structure

This is a **pnpm monorepo** with three packages:

```
carbobo/
├── frontend/          # Vue 3 + Vite + TypeScript SPA
├── backend/           # Express.js 5 + TypeScript REST API
├── shared/            # Shared TypeScript type definitions
├── package.json       # Root workspace config
├── pnpm-workspace.yaml
├── README.md
├── PROJECT_PLAN.md    # Product strategy and roadmap
└── PRD.md             # Product requirements document
```

Workspace package names: `@carbobo/frontend`, `@carbobo/backend`, `@carbobo/shared`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | Vue 3 (Composition API, `<script setup>`) |
| Frontend build | Vite 7 |
| State management | Pinia |
| Routing | Vue Router 5 |
| UI components | shadcn-vue (Radix-based, Tailwind-styled) |
| Styling | Tailwind CSS v3 |
| HTTP client | Axios |
| Backend framework | Express.js 5 |
| Database | SQLite via better-sqlite3 (synchronous) |
| Authentication | JWT (jsonwebtoken) + bcrypt |
| File uploads | Multer |
| Testing | Vitest (both frontend and backend) |
| Language | TypeScript throughout |
| Package manager | pnpm 8+ |

---

## Development Commands

### Prerequisites
- Node.js 20 LTS or 22 LTS (preferred); Node 24 works with better-sqlite3 12+
- pnpm 8+

### Setup
```bash
pnpm install          # Install all dependencies
```

### Running the app
```bash
pnpm dev              # Start frontend (port 5173) + backend (port 3000) in parallel
cd frontend && pnpm dev   # Frontend only
cd backend && pnpm dev    # Backend only
```

### Building
```bash
pnpm build            # Build shared → frontend → backend (in order)
pnpm run rebuild      # Clean install + full rebuild (use `run` to avoid pnpm's native rebuild)
```

### Testing
```bash
# Frontend
pnpm --filter frontend test -- --run   # Single run
pnpm --filter frontend test            # Watch mode
pnpm --filter frontend test:ui         # Vitest browser UI

# Backend
cd backend && pnpm test                # Single run
cd backend && pnpm test:watch          # Watch mode
```

### Environment Variables

**`backend/.env`** (copy from `backend/.env.example`):
```env
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
DB_PATH=./carbobo.db
UPLOAD_DIR=./uploads
FRONTEND_URL=http://localhost:5173
FUEL_FINDER_API_KEY=
```

**`frontend/.env`** (copy from `frontend/.env.example`):
```env
VITE_API_URL=http://localhost:3000/api
```

---

## Backend Architecture

### Entry Points
- `backend/src/server.ts` — Starts the HTTP server
- `backend/src/app.ts` — Express app, middleware setup, route mounting

### Route Files (`backend/src/routes/`)
Each file maps to one feature domain:

| File | Base Path | Description |
|------|-----------|-------------|
| `auth.ts` | `/api/auth` | Register, login, `/me` |
| `vehicles.ts` | `/api/vehicles` | Vehicle CRUD |
| `fuel.ts` | `/api/vehicles/:vehicleId/fuel` | Fuel entry logging |
| `healthScans.ts` | `/api/vehicles/:vehicleId/health-scans` | Monthly health scans |
| `documents.ts` | `/api/vehicles/:vehicleId/documents` | Document vault |
| `reminders.ts` | `/api/reminders` | MOT/service/insurance reminders |
| `fuelPrices.ts` | `/api/fuel-prices` | Nearby UK fuel prices (stub) |
| `resalePack.ts` | `/api/resale-packs` | Resale evidence pack generation |

### Services (`backend/src/services/`)
- `fuelCalculations.ts` — Pure functions: MPG, L/100km, cost/mile. Uses UK gallons (4.54609 L). Handles partial fill-ups by aggregating to full-tank intervals.
- `healthScanAdvice.ts` — Rule-based advice generator for monthly health scans.

### Middleware (`backend/src/middleware/`)
- `auth.ts` — `authenticateToken` middleware. Extracts JWT from `Authorization: Bearer` header; attaches `req.userId` to requests.

### Database (`backend/src/db/`)
- `index.ts` — SQLite schema creation and db singleton export.
- Uses better-sqlite3 (synchronous API — no `await` needed).
- Database file: `carbobo.db` (auto-created on first run).
- Foreign keys are enabled (`PRAGMA foreign_keys = ON`).

**Tables**: `users`, `vehicles`, `fuel_entries`, `health_scans`, `documents`, `reminders`, `resale_packs`

### Test Setup
- `backend/src/test-setup.ts` — Creates an in-memory SQLite `:memory:` database for tests.
- Tests use `supertest` to make HTTP requests against the real Express app.
- Existing test: `backend/src/routes/auth.test.ts`

---

## Frontend Architecture

### Entry Points
- `frontend/src/main.ts` — Creates Vue app, installs Pinia and Vue Router
- `frontend/src/App.vue` — Root component with nav layout shell

### Views (`frontend/src/views/`)
One component per page:
- `Dashboard.vue` — Home/vehicle list
- `VehicleForm.vue` — Create/edit vehicle
- `FuelEntry.vue` — Add/edit fuel fill
- `FuelHistory.vue` — Fuel log with calculated stats
- `HealthScan.vue` — Capture scan (photos + questions)
- `HealthScans.vue` — Health scan timeline
- `Documents.vue` — Document vault
- `Reminders.vue` — MOT/service/insurance reminders
- `FuelPrices.vue` — Nearby station lookup by postcode
- `ResalePack.vue` — Generate resale pack
- `ResalePackPublic.vue` — Public shareable pack view
- `Login.vue`, `Register.vue` — Auth screens

### State Management (`frontend/src/stores/`)
- `auth.ts` — `useAuthStore()`: login, register, logout, token persistence in `localStorage`
- `vehicles.ts` — `useVehicleStore()`: vehicle list, current vehicle selection

### API Client (`frontend/src/api/client.ts`)
- Axios instance with base URL from `VITE_API_URL`
- **Request interceptor**: attaches `Authorization: Bearer <token>` to every request
- **Response interceptor**: on 401, clears token and redirects to `/login`
- Dev proxy: `/api` → `http://localhost:3000` (via `frontend/vite.config.ts`)

### Router (`frontend/src/router/index.ts`)
- 14+ routes
- Routes with `meta.requiresAuth: true` redirect to `/login` if unauthenticated
- Navigation guard in router

### UI Components (`frontend/src/components/ui/`)
shadcn-vue pattern:
- Each component is Radix primitive + Tailwind styling + CVA variants
- Available: `Button`, `Card`, `Checkbox`, `Input`, `Label`, `Select`, `Slider`
- Import from `@/components/ui/button` etc. (path alias `@` = `src/`)

---

## Shared Types (`shared/src/types/index.ts`)

Single source of truth for TypeScript interfaces shared between frontend and backend:
- **Domain interfaces**: `User`, `Vehicle`, `Document`, `HealthScan`, `FuelEntry`, `Reminder`, `FuelStats`, `FuelInterval`
- **Enums**: `FuelType`, `OdometerUnit`, `DocumentType`, `ReminderType`

Always use these shared types rather than defining duplicate interfaces in frontend or backend.

---

## Naming Conventions

| Context | Convention | Examples |
|---------|-----------|---------|
| Database columns | snake_case | `fuel_entries`, `is_full_tank`, `occurred_at` |
| TypeScript files | camelCase | `fuelCalculations.ts`, `healthScanAdvice.ts` |
| Vue components | PascalCase.vue | `Dashboard.vue`, `FuelEntry.vue` |
| URL routes | kebab-case | `/fuel-prices`, `/health-scans` |
| Pinia stores | camelCase composable | `useAuthStore()`, `useVehicleStore()` |
| Environment variables | SCREAMING_SNAKE_CASE (backend), `VITE_` prefix (frontend) | `JWT_SECRET`, `VITE_API_URL` |

---

## Key Business Logic

### Fuel Economy Calculations
- **UK gallons**: 1 gallon = 4.54609 litres (not US gallons)
- **Partial fills**: Accumulated until a `is_full_tank = true` entry; MPG calculated over full intervals
- **Metrics**: MPG (UK), L/100km, cost per mile — all derived from `FuelInterval` aggregations
- Logic lives in `backend/src/services/fuelCalculations.ts`

### Health Scans
- Captured monthly with up to 3 photos (exterior, interior, engine bay)
- Questions: warning lights, noises, odometer
- Rule-based advice generated server-side in `healthScanAdvice.ts`
- Cautious language only ("consult a mechanic") — not diagnostic

### Authentication Flow
1. User registers/logs in → receives JWT (7-day expiry)
2. JWT stored in `localStorage` by auth store
3. Axios interceptor injects `Authorization: Bearer <token>` on every request
4. Backend `authenticateToken` middleware verifies JWT, adds `req.userId`
5. 401 → interceptor clears storage + redirects to `/login`

### Resale Pack
- User selects vehicle + date range → generates a sharable public URL
- Public link (`/resale-pack/:shareId`) accessible without authentication

---

## Architecture Decisions & Constraints

- **SQLite** — Synchronous better-sqlite3. Do not introduce `async/await` wrappers around db calls unless switching to an async driver.
- **No ORM** — Raw SQL queries in route handlers and services.
- **No ESLint/Prettier** — No linting or formatting config exists. Do not assume auto-formatting will run.
- **No CI/CD** — No GitHub Actions or deployment pipeline configured.
- **File uploads** — Stored locally in `backend/uploads/`. Not suitable for multi-instance deployment without shared storage.
- **Fuel Finder API** — Currently a stub returning fake data. Real integration requires `FUEL_FINDER_API_KEY`.
- **Mobile-first** — UI designed for small screens; test on mobile viewport.

---

## Testing Guidelines

- **Backend**: Use Vitest + supertest. Tests run against in-memory SQLite (`:memory:`). Import app from `src/app.ts`.
- **Frontend**: Use Vitest + `@vue/test-utils` + jsdom. Mount components with `mount()` or `shallowMount()`.
- **Test files**: Co-located with source (`*.test.ts`) or in `example/` subdirectory.
- **Coverage**: Currently minimal (only `auth.test.ts` in backend). New features should include tests.

---

## Common Pitfalls

1. **`pnpm rebuild` vs `pnpm run rebuild`** — Always use `pnpm run rebuild` (with `run`). `pnpm rebuild` invokes pnpm's native binary rebuild, not the root workspace script.
2. **Build order matters** — `shared` must be built before `frontend` or `backend` since they import from `@carbobo/shared`.
3. **CORS in dev** — Frontend proxies `/api` to backend via Vite config. In production, CORS is restricted to `FRONTEND_URL`.
4. **JWT secret** — Must set a strong `JWT_SECRET` in production. Default `.env.example` value is insecure.
5. **SQLite foreign keys** — Enabled at connection time in `db/index.ts`. Cascade deletes are on for `userId` relationships.
6. **UK gallons** — Never use US gallons (3.78541 L) for fuel calculations. Always use 4.54609 L.
