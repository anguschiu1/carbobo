import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/index.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import type { Vehicle, FuelType, OdometerUnit } from '@carbobo/shared'

const router = Router()
const db = getDatabase()

// All routes require authentication
router.use(authenticateToken)

// Get all vehicles for user
router.get('/', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const vehicles = db
      .prepare('SELECT * FROM vehicles WHERE owner_user_id = ? ORDER BY created_at DESC')
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
      .prepare('SELECT * FROM vehicles WHERE id = ? AND owner_user_id = ?')
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
    } = req.body

    if (!fuel_type_default || !odometer_unit_default) {
      return res.status(400).json({ error: 'Fuel type and odometer unit are required' })
    }

    const vehicleId = uuidv4()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO vehicles (
        id, owner_user_id, vrm, make, model, year,
        fuel_type_default, odometer_unit_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      vehicleId,
      userId,
      vrm || null,
      make || null,
      model || null,
      year || null,
      fuel_type_default,
      odometer_unit_default,
      now,
      now
    )

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId) as Vehicle

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
    } = req.body

    // Verify ownership
    const existing = db
      .prepare('SELECT id FROM vehicles WHERE id = ? AND owner_user_id = ?')
      .get(vehicleId, userId)

    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    const updates: string[] = []
    const values: any[] = []

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

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
    values.push(vehicleId, userId)

    db.prepare(
      `UPDATE vehicles SET ${updates.join(', ')} WHERE id = ? AND owner_user_id = ?`
    ).run(...values)

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId) as Vehicle

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
