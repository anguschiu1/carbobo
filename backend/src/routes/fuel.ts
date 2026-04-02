import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/index.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { verifyVehicleOwnership } from '../middleware/vehicleOwnership.js'
import { param } from '../utils/params.js'
import { calculateFuelStats, validateFuelEntry, calculateFuelIntervals } from '../services/fuelCalculations.js'
import type { FuelEntry } from '@carbobo/shared'

const router = Router()
const db = getDatabase()

// All routes require authentication
router.use(authenticateToken)

// Create fuel entry
router.post('/:vehicleId/fuel', verifyVehicleOwnership, (req: AuthRequest, res) => {
  try {
    const vehicleId = param(req, 'vehicleId')

    const {
      occurred_at,
      odometer_reading,
      odometer_unit,
      litres_added,
      is_full_tank = false,
      total_cost_gbp,
      price_pence_per_litre,
      fuel_type,
      town_pct = 0,
      notes,
    } = req.body

    // Get vehicle for defaults
    const vehicle = db.prepare('SELECT fuel_type_default, odometer_unit_default FROM vehicles WHERE id = ?').get(vehicleId) as {
      fuel_type_default: string
      odometer_unit_default: string
    }

    // Get previous entries for validation
    const previousEntries = db
      .prepare('SELECT id, vehicle_id, occurred_at, odometer_reading, odometer_unit, litres_added, is_full_tank, total_cost_gbp, price_pence_per_litre, fuel_type, town_pct, notes, created_at FROM fuel_entries WHERE vehicle_id = ? ORDER BY occurred_at DESC')
      .all(vehicleId) as FuelEntry[]

    const entry: Partial<FuelEntry> = {
      vehicle_id: vehicleId,
      occurred_at: occurred_at || new Date().toISOString(),
      odometer_reading,
      odometer_unit: odometer_unit || vehicle.odometer_unit_default,
      litres_added,
      is_full_tank: Boolean(is_full_tank),
      total_cost_gbp,
      price_pence_per_litre,
      fuel_type: fuel_type || vehicle.fuel_type_default,
      town_pct: Math.max(0, Math.min(100, town_pct)),
      notes,
    }

    const validation = validateFuelEntry(entry, previousEntries)
    if (!validation.valid) {
      return res.status(400).json({ error: validation.warning })
    }

    const entryId = uuidv4()
    const now = new Date().toISOString()

    // better-sqlite3 only binds number, string, bigint, buffer, null (no boolean/undefined)
    const isFullTank = entry.is_full_tank ? 1 : 0
    const townPct = Number.isFinite(entry.town_pct) ? entry.town_pct! : 0

    db.prepare(
      `INSERT INTO fuel_entries (
        id, vehicle_id, occurred_at, odometer_reading, odometer_unit,
        litres_added, is_full_tank, total_cost_gbp, price_pence_per_litre,
        fuel_type, town_pct, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entryId,
      vehicleId,
      entry.occurred_at!,
      Number(entry.odometer_reading),
      entry.odometer_unit!,
      Number(entry.litres_added),
      isFullTank,
      Number(entry.total_cost_gbp),
      Number(entry.price_pence_per_litre),
      entry.fuel_type!,
      townPct,
      entry.notes ?? null,
      now
    )

    const newEntry = db.prepare('SELECT id, vehicle_id, occurred_at, odometer_reading, odometer_unit, litres_added, is_full_tank, total_cost_gbp, price_pence_per_litre, fuel_type, town_pct, notes, created_at FROM fuel_entries WHERE id = ?').get(entryId) as FuelEntry

    res.status(201).json({
      entry: newEntry,
      warning: validation.warning,
    })
  } catch (error) {
    console.error('Create fuel entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get fuel entries for vehicle
router.get('/:vehicleId/fuel', verifyVehicleOwnership, (req: AuthRequest, res) => {
  try {
    const vehicleId = param(req, 'vehicleId')

    const entries = db
      .prepare('SELECT id, vehicle_id, occurred_at, odometer_reading, odometer_unit, litres_added, is_full_tank, total_cost_gbp, price_pence_per_litre, fuel_type, town_pct, notes, created_at FROM fuel_entries WHERE vehicle_id = ? ORDER BY occurred_at DESC')
      .all(vehicleId) as FuelEntry[]

    // Convert boolean fields
    const entriesWithBooleans = entries.map((entry) => ({
      ...entry,
      is_full_tank: Boolean(entry.is_full_tank),
    }))

    res.json({ entries: entriesWithBooleans })
  } catch (error) {
    console.error('Get fuel entries error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get fuel stats
router.get('/:vehicleId/fuel/stats', verifyVehicleOwnership, (req: AuthRequest, res) => {
  try {
    const vehicleId = param(req, 'vehicleId')

    const entries = db
      .prepare('SELECT id, vehicle_id, occurred_at, odometer_reading, odometer_unit, litres_added, is_full_tank, total_cost_gbp, price_pence_per_litre, fuel_type, town_pct, notes, created_at FROM fuel_entries WHERE vehicle_id = ? ORDER BY occurred_at ASC')
      .all(vehicleId) as FuelEntry[]

    // Convert boolean fields
    const entriesWithBooleans = entries.map((entry) => ({
      ...entry,
      is_full_tank: Boolean(entry.is_full_tank),
    }))

    const stats = calculateFuelStats(entriesWithBooleans)
    const intervals = calculateFuelIntervals(entriesWithBooleans)

    res.json({ stats, intervals })
  } catch (error) {
    console.error('Get fuel stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update fuel entry
router.put('/:vehicleId/fuel/:entryId', verifyVehicleOwnership, (req: AuthRequest, res) => {
  try {
    const vehicleId = param(req, 'vehicleId')
    const entryId = param(req, 'entryId')

    // Verify entry belongs to vehicle
    const existing = db
      .prepare('SELECT id FROM fuel_entries WHERE id = ? AND vehicle_id = ?')
      .get(entryId, vehicleId)

    if (!existing) {
      return res.status(404).json({ error: 'Fuel entry not found' })
    }

    const updates: string[] = []
    const values: any[] = []

    const fields = [
      'occurred_at',
      'odometer_reading',
      'odometer_unit',
      'litres_added',
      'is_full_tank',
      'total_cost_gbp',
      'price_pence_per_litre',
      'fuel_type',
      'town_pct',
      'notes',
    ]

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'is_full_tank') {
          updates.push(`${field} = ?`)
          values.push(req.body[field] ? 1 : 0)
        } else {
          updates.push(`${field} = ?`)
          values.push(req.body[field])
        }
      }
    })

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    values.push(entryId, vehicleId)

    db.prepare(
      `UPDATE fuel_entries SET ${updates.join(', ')} WHERE id = ? AND vehicle_id = ?`
    ).run(...values)

    const updated = db.prepare('SELECT id, vehicle_id, occurred_at, odometer_reading, odometer_unit, litres_added, is_full_tank, total_cost_gbp, price_pence_per_litre, fuel_type, town_pct, notes, created_at FROM fuel_entries WHERE id = ?').get(entryId) as FuelEntry

    res.json({
      entry: {
        ...updated,
        is_full_tank: Boolean(updated.is_full_tank),
      },
    })
  } catch (error) {
    console.error('Update fuel entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete fuel entry
router.delete('/:vehicleId/fuel/:entryId', verifyVehicleOwnership, (req: AuthRequest, res) => {
  try {
    const vehicleId = param(req, 'vehicleId')
    const entryId = param(req, 'entryId')

    const result = db
      .prepare('DELETE FROM fuel_entries WHERE id = ? AND vehicle_id = ?')
      .run(entryId, vehicleId)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Fuel entry not found' })
    }

    res.json({ message: 'Fuel entry deleted successfully' })
  } catch (error) {
    console.error('Delete fuel entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
