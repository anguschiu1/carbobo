# UK Car Health Coach + Fuel Saver

A mobile-first web app for UK car owners to track vehicle maintenance, fuel consumption, and generate resale evidence packs.

## Tech Stack

- **Frontend**: Vue 3 + Vite + TypeScript + shadcn-vue + Tailwind CSS
- **Backend**: Express.js + TypeScript + SQLite
- **Package Manager**: pnpm (workspace monorepo)

## Getting Started

### Prerequisites

- **Node.js 20 LTS or 22 LTS** (recommended; Node 24 works with better-sqlite3 12+)
- pnpm 8+

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:

Backend (`backend/.env`):
```env
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
DB_PATH=./carbobo.db
UPLOAD_DIR=./uploads
FRONTEND_URL=http://localhost:5173
FUEL_FINDER_API_KEY=
```

Frontend (`frontend/.env`):
```env
VITE_API_URL=http://localhost:3000/api
```

### Build

From repo root:
```bash
pnpm build
```

Full clean reinstall and build (use **`pnpm run rebuild`** with `run`, not `pnpm rebuild`):
```bash
pnpm run rebuild
```
This cleans `node_modules` and build outputs, reinstalls deps (including building native modules `bcrypt` and `better-sqlite3`), then runs the full build.

**macOS:** If `better-sqlite3` fails to build with "No Xcode or CLT version detected", either install Command Line Tools (`xcode-select --install`) or use Node 20/22 LTS so prebuilt binaries are used. With Node 24, we use better-sqlite3 12+ which provides prebuilds and avoids compiling.

### Development

Start both frontend and backend:
```bash
pnpm dev
```

Or start individually:
```bash
# Frontend only
cd frontend && pnpm dev

# Backend only
cd backend && pnpm dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3000

### Testing the UI

**Manual testing in the browser**

1. Start the app (frontend + backend):
   ```bash
   pnpm dev
   ```
2. Open http://localhost:5173 and click through the app (login, vehicles, fuel, health scans, etc.).

**Automated tests (Vitest)**

From the repo root:
```bash
# Run frontend tests once
pnpm --filter frontend test -- --run

# Watch mode (re-run on file changes)
pnpm --filter frontend test

# Vitest UI (browser UI to run and inspect tests)
pnpm --filter frontend test:ui
```

From the frontend directory:
```bash
cd frontend
pnpm test -- --run    # single run
pnpm test             # watch
pnpm test:ui          # open Vitest UI in browser
```

Tests live in `frontend/src` (e.g. `*.test.ts`, `*.spec.ts`, or files under `example/`). They use Vitest and `@vue/test-utils` for component tests.

**Backend API tests (e.g. register)**

```bash
cd backend && pnpm test        # single run
cd backend && pnpm test:watch  # watch
```

Uses Vitest + supertest against an in-memory SQLite DB. See `backend/src/routes/auth.test.ts` for the register API tests.

## Features

- ✅ User authentication (JWT)
- ✅ Vehicle management
- ✅ Fuel logging with MPG/L/100km calculations (supports partial fills)
- ✅ Monthly health scans with photo uploads
- ✅ Document vault
- ✅ Reminders (MOT, service, insurance)
- ✅ Nearby fuel prices (UK Fuel Finder API stub)
- ✅ Resale pack generation and sharing

## Project Structure

```
carbobo/
├── frontend/          # Vue.js app
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── views/       # Page components
│   │   ├── stores/      # Pinia stores
│   │   ├── api/         # API client
│   │   └── router/      # Vue Router
│   └── package.json
├── backend/           # Express.js API
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── services/   # Business logic
│   │   ├── middleware/ # Auth, etc.
│   │   └── db/         # Database
│   └── package.json
├── shared/            # Shared TypeScript types
└── package.json       # Root workspace config
```

## Database

SQLite database is created automatically on first run. Database file: `carbobo.db`

## Notes

- Fuel Finder API integration requires API key - currently returns stub data
- File uploads stored locally in `backend/uploads/`
- Mobile-first responsive design
- UK-specific: MPG uses UK gallons (4.54609 L), currency is GBP

## License

MIT
