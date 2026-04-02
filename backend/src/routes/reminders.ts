import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/index.js'
import { param } from '../utils/params.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { verifyVehicleOwnership } from '../middleware/vehicleOwnership.js'
import type { Reminder } from '@carbobo/shared'

const router = Router()
const db = getDatabase()

// All routes require authentication
router.use(authenticateToken)

// Create reminder
router.post('/:vehicleId/reminders', verifyVehicleOwnership, (req: AuthRequest, res) => {
  try {
    const vehicleId = param(req, 'vehicleId')

    const { type, due_date, notes } = req.body

    if (!type || !due_date) {
      return res.status(400).json({ error: 'Type and due_date are required' })
    }

    const reminderId = uuidv4()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO reminders (
        id, vehicle_id, type, due_date, is_completed, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(reminderId, vehicleId, type, due_date, 0, notes || null, now)

    const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(reminderId) as Reminder

    res.status(201).json({
      reminder: {
        ...reminder,
        is_completed: Boolean(reminder.is_completed),
      },
    })
  } catch (error) {
    console.error('Create reminder error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get reminders for vehicle
router.get('/:vehicleId/reminders', verifyVehicleOwnership, (req: AuthRequest, res) => {
  try {
    const vehicleId = param(req, 'vehicleId')

    const reminders = db
      .prepare('SELECT * FROM reminders WHERE vehicle_id = ? ORDER BY due_date ASC')
      .all(vehicleId) as Reminder[]

    const remindersWithBooleans = reminders.map((reminder) => ({
      ...reminder,
      is_completed: Boolean(reminder.is_completed),
    }))

    res.json({ reminders: remindersWithBooleans })
  } catch (error) {
    console.error('Get reminders error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get upcoming reminders (all vehicles for user)
// This route is mounted at /api, so path is /reminders/upcoming
router.get('/reminders/upcoming', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const limit = parseInt(req.query.limit as string) || 10

    const reminders = db
      .prepare(
        `SELECT r.* FROM reminders r
         INNER JOIN vehicles v ON r.vehicle_id = v.id
         WHERE v.owner_user_id = ? AND r.is_completed = 0 AND r.due_date >= date('now')
         ORDER BY r.due_date ASC
         LIMIT ?`
      )
      .all(userId, limit) as Reminder[]

    const remindersWithBooleans = reminders.map((reminder) => ({
      ...reminder,
      is_completed: Boolean(reminder.is_completed),
    }))

    res.json({ reminders: remindersWithBooleans })
  } catch (error) {
    console.error('Get upcoming reminders error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update reminder
router.put('/reminders/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const reminderId = param(req, 'id')

    // Verify ownership through vehicle
    const reminder = db
      .prepare(
        `SELECT r.* FROM reminders r
         INNER JOIN vehicles v ON r.vehicle_id = v.id
         WHERE r.id = ? AND v.owner_user_id = ?`
      )
      .get(reminderId, userId) as Reminder | undefined

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' })
    }

    const updates: string[] = []
    const values: any[] = []

    if (req.body.type !== undefined) {
      updates.push('type = ?')
      values.push(req.body.type)
    }
    if (req.body.due_date !== undefined) {
      updates.push('due_date = ?')
      values.push(req.body.due_date)
    }
    if (req.body.is_completed !== undefined) {
      updates.push('is_completed = ?')
      values.push(req.body.is_completed ? 1 : 0)
    }
    if (req.body.notes !== undefined) {
      updates.push('notes = ?')
      values.push(req.body.notes || null)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    values.push(reminderId)

    db.prepare(`UPDATE reminders SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM reminders WHERE id = ?').get(reminderId) as Reminder

    res.json({
      reminder: {
        ...updated,
        is_completed: Boolean(updated.is_completed),
      },
    })
  } catch (error) {
    console.error('Update reminder error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete reminder
router.delete('/reminders/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const reminderId = param(req, 'id')

    // Verify ownership through vehicle
    const reminder = db
      .prepare(
        `SELECT r.* FROM reminders r
         INNER JOIN vehicles v ON r.vehicle_id = v.id
         WHERE r.id = ? AND v.owner_user_id = ?`
      )
      .get(reminderId, userId)

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' })
    }

    db.prepare('DELETE FROM reminders WHERE id = ?').run(reminderId)

    res.json({ message: 'Reminder deleted successfully' })
  } catch (error) {
    console.error('Delete reminder error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
