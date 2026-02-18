# UK Car Health Coach + Fuel Saver

A mobile-first web app for UK car owners to track vehicle maintenance, fuel consumption, and generate resale evidence packs.

## Tech Stack

- **Frontend**: Vue 3 + Vite + TypeScript + shadcn-vue + Tailwind CSS
- **Backend**: Express.js + TypeScript + SQLite
- **Package Manager**: pnpm (workspace monorepo)

## Getting Started

### Prerequisites

- Node.js 18+ 
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
