import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/index.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import type { Vehicle, FuelType, OdometerUnit } from '@carbobo/shared'

const router = Router()
const db = getDatabase()

// All routes require authentication
router.use(authenticateToken)

const VEHICLE_COLUMNS = `
  id, owner_user_id, vrm, make, model, year,
  fuel_type_default, odometer_unit_default, tank_size_litres,
  created_at, updated_at
`

// Get all vehicles for user
router.get('/', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const vehicles = db
      .prepare(`SELECT ${VEHICLE_COLUMNS} FROM vehicles WHERE owner_user_id = ? ORDER BY created_at DESC`)
      .all(userId) as Vehicle[]

    res.json({ vehicles })
  } catch (error) {
    console.error('Get vehicles error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get single vehicle
router.get('/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const vehicleId = req.params.id

    const vehicle = db
      .prepare(`SELECT ${VEHICLE_COLUMNS} FROM vehicles WHERE id = ? AND owner_user_id = ?`)
      .get(vehicleId, userId) as Vehicle | undefined

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    res.json({ vehicle })
  } catch (error) {
    console.error('Get vehicle error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create vehicle
router.post('/', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const {
      vrm,
      make,
      model,
      year,
      fuel_type_default = 'petrol',
      odometer_unit_default = 'miles',
      tank_size_litres,
    } = req.body

    if (!fuel_type_default || !odometer_unit_default) {
      return res.status(400).json({ error: 'Fuel type and odometer unit are required' })
    }

    const vehicleId = uuidv4()
    const now = new Date().toISOString()
    if (tank_size_litres !== undefined) {
      const n = Number(tank_size_litres)
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 10 || n > 200) {
        return res.status(400).json({ error: 'tank_size_litres must be a whole number between 10 and 200' })
      }
    }
    const tankSize = tank_size_litres !== undefined ? Number(tank_size_litres) : 50

    db.prepare(
      `INSERT INTO vehicles (
        id, owner_user_id, vrm, make, model, year,
        fuel_type_default, odometer_unit_default, tank_size_litres, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      vehicleId,
      userId,
      vrm || null,
      make || null,
      model || null,
      year || null,
      fuel_type_default,
      odometer_unit_default,
      tankSize,
      now,
      now
    )

    const vehicle = db.prepare(`SELECT ${VEHICLE_COLUMNS} FROM vehicles WHERE id = ?`).get(vehicleId) as Vehicle

    res.status(201).json({ vehicle })
  } catch (error) {
    console.error('Create vehicle error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update vehicle
router.put('/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const vehicleId = req.params.id
    const {
      vrm,
      make,
      model,
      year,
      fuel_type_default,
      odometer_unit_default,
      tank_size_litres,
    } = req.body

    // Verify ownership and get existing odometer unit
    const existing = db
      .prepare(
        'SELECT id, odometer_unit_default FROM vehicles WHERE id = ? AND owner_user_id = ?',
      )
      .get(vehicleId, userId) as { id: string; odometer_unit_default: OdometerUnit } | undefined

    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (vrm !== undefined) {
      updates.push('vrm = ?')
      values.push(vrm || null)
    }
    if (make !== undefined) {
      updates.push('make = ?')
      values.push(make || null)
    }
    if (model !== undefined) {
      updates.push('model = ?')
      values.push(model || null)
    }
    if (year !== undefined) {
      updates.push('year = ?')
      values.push(year || null)
    }
    if (fuel_type_default !== undefined) {
      updates.push('fuel_type_default = ?')
      values.push(fuel_type_default)
    }
    if (odometer_unit_default !== undefined) {
      updates.push('odometer_unit_default = ?')
      values.push(odometer_unit_default)
    }
    if (tank_size_litres !== undefined) {
      const n = Number(tank_size_litres)
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 10 || n > 200) {
        return res.status(400).json({ error: 'tank_size_litres must be a whole number between 10 and 200' })
      }
      updates.push('tank_size_litres = ?')
      values.push(n)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
    values.push(vehicleId, userId)

    db.prepare(
      `UPDATE vehicles SET ${updates.join(', ')} WHERE id = ? AND owner_user_id = ?`
    ).run(...values)

    // If odometer unit changed, recalculate all fuel entry odometer readings for this vehicle
    if (
      odometer_unit_default &&
      odometer_unit_default !== existing.odometer_unit_default &&
      (odometer_unit_default === 'miles' || odometer_unit_default === 'km') &&
      (existing.odometer_unit_default === 'miles' || existing.odometer_unit_default === 'km')
    ) {
      const milesToKm = 1.60934
      if (existing.odometer_unit_default === 'miles' && odometer_unit_default === 'km') {
        // Convert miles → km
        db.prepare(
          'UPDATE fuel_entries SET odometer_reading = odometer_reading * ?, odometer_unit = ? WHERE vehicle_id = ? AND odometer_unit = ?',
        ).run(milesToKm, 'km', vehicleId, 'miles')
      } else if (existing.odometer_unit_default === 'km' && odometer_unit_default === 'miles') {
        // Convert km → miles
        db.prepare(
          'UPDATE fuel_entries SET odometer_reading = odometer_reading / ?, odometer_unit = ? WHERE vehicle_id = ? AND odometer_unit = ?',
        ).run(milesToKm, 'miles', vehicleId, 'km')
      }
    }

    const vehicle = db.prepare(`SELECT ${VEHICLE_COLUMNS} FROM vehicles WHERE id = ?`).get(vehicleId) as Vehicle

    res.json({ vehicle })
  } catch (error) {
    console.error('Update vehicle error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete vehicle
router.delete('/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const vehicleId = req.params.id

    // Verify ownership
    const existing = db
      .prepare('SELECT id FROM vehicles WHERE id = ? AND owner_user_id = ?')
      .get(vehicleId, userId)

    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    db.prepare('DELETE FROM vehicles WHERE id = ? AND owner_user_id = ?').run(vehicleId, userId)

    res.json({ message: 'Vehicle deleted successfully' })
  } catch (error) {
    console.error('Delete vehicle error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
