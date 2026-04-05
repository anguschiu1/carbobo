import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

const DB_PATH = process.env.DB_PATH || join(process.cwd(), 'carbobo.db')
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')

// Ensure upload directories exist
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true })
}
if (!existsSync(join(UPLOAD_DIR, 'health-scans'))) {
  mkdirSync(join(UPLOAD_DIR, 'health-scans'), { recursive: true })
}
if (!existsSync(join(UPLOAD_DIR, 'documents'))) {
  mkdirSync(join(UPLOAD_DIR, 'documents'), { recursive: true })
}

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initDatabase() {
  const database = getDatabase()

  // Create tables
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      vrm TEXT,
      make TEXT,
      model TEXT,
      year INTEGER,
      fuel_type_default TEXT NOT NULL DEFAULT 'petrol',
      odometer_unit_default TEXT NOT NULL DEFAULT 'miles',
      -- Migration note: added 2026-04-05 — tank_size_litres stores the fuel tank
      -- capacity in litres. Defaults to 50 (a typical UK car). Used by the
      -- FuelPrices feature to calculate per-tank cost estimates.
      -- For existing databases, run: ALTER TABLE vehicles ADD COLUMN tank_size_litres INTEGER NOT NULL DEFAULT 50;
      tank_size_litres INTEGER NOT NULL DEFAULT 50,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      type TEXT NOT NULL,
      file_url TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS health_scans (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      scan_at TEXT NOT NULL,
      tyre_photo_url TEXT,
      exterior_photo_url TEXT,
      dashboard_photo_url TEXT,
      odometer_reading REAL NOT NULL,
      odometer_unit TEXT NOT NULL,
      warning_lights INTEGER NOT NULL DEFAULT 0,
      new_noises INTEGER NOT NULL DEFAULT 0,
      generated_advice TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fuel_entries (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      odometer_reading REAL NOT NULL,
      odometer_unit TEXT NOT NULL,
      litres_added REAL NOT NULL,
      is_full_tank INTEGER NOT NULL DEFAULT 0,
      total_cost_gbp REAL NOT NULL,
      price_pence_per_litre INTEGER NOT NULL,
      fuel_type TEXT NOT NULL,
      town_pct INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      type TEXT NOT NULL,
      due_date TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS resale_packs (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      share_id TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_fuel_entries_vehicle ON fuel_entries(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_fuel_entries_occurred ON fuel_entries(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_health_scans_vehicle ON health_scans(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_documents_vehicle ON documents(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_vehicle ON reminders(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
  `)

  // Run migrations for existing databases
  const columns = database.pragma('table_info(vehicles)') as { name: string }[]
  if (!columns.some(c => c.name === 'tank_size_litres')) {
    database.exec('ALTER TABLE vehicles ADD COLUMN tank_size_litres INTEGER NOT NULL DEFAULT 50')
    console.log('Migration: added tank_size_litres column to vehicles')
  }

  console.log('Database initialized successfully')
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}
