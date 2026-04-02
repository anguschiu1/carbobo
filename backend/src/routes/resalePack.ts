import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/index.js'
import { calculateFuelStats } from '../services/fuelCalculations.js'
import type { Vehicle, HealthScan, Document, FuelEntry, Reminder } from '@carbobo/shared'

const router = Router()
const db = getDatabase()

/**
 * Generate a shareable resale pack link
 * POST /api/vehicles/:id/resale-pack/generate
 * Requires authentication
 */
router.post('/vehicles/:vehicleId/resale-pack/generate', (req, res) => {
  try {
    const vehicleId = req.params.vehicleId
    const userId = (req as any).userId

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Verify vehicle ownership
    const vehicle = db
      .prepare('SELECT * FROM vehicles WHERE id = ? AND owner_user_id = ?')
      .get(vehicleId, userId) as Vehicle | undefined

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    // Check if resale pack already exists
    const existing = db
      .prepare('SELECT * FROM resale_packs WHERE vehicle_id = ?')
      .get(vehicleId) as { share_id: string } | undefined

    let shareId: string

    if (existing) {
      shareId = existing.share_id
    } else {
      // Generate new share ID
      shareId = uuidv4()
      const now = new Date().toISOString()

      db.prepare('INSERT INTO resale_packs (id, vehicle_id, share_id, created_at) VALUES (?, ?, ?, ?)').run(
        uuidv4(),
        vehicleId,
        shareId,
        now
      )
    }

    res.json({ share_id: shareId, share_url: `/resale-pack/${shareId}` })
  } catch (error) {
    console.error('Generate resale pack error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Get public resale pack view (no auth required)
 * GET /api/resale-pack/:shareId
 */
router.get('/resale-pack/:shareId', (req, res) => {
  try {
    const shareId = req.params.shareId

    // Find resale pack
    const resalePack = db
      .prepare('SELECT * FROM resale_packs WHERE share_id = ?')
      .get(shareId) as { vehicle_id: string } | undefined

    if (!resalePack) {
      return res.status(404).json({ error: 'Resale pack not found' })
    }

    const vehicleId = resalePack.vehicle_id

    // Get vehicle
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId) as Vehicle

    // Get health scans
    const healthScans = db
      .prepare('SELECT * FROM health_scans WHERE vehicle_id = ? ORDER BY scan_at DESC')
      .all(vehicleId) as HealthScan[]

    // Get documents
    const documents = db
      .prepare('SELECT * FROM documents WHERE vehicle_id = ? ORDER BY occurred_at DESC')
      .all(vehicleId) as Document[]

    // Get fuel entries and stats
    const fuelEntries = db
      .prepare('SELECT * FROM fuel_entries WHERE vehicle_id = ? ORDER BY occurred_at ASC')
      .all(vehicleId) as FuelEntry[]

    const fuelStats = calculateFuelStats(
      fuelEntries.map((e) => ({ ...e, is_full_tank: Boolean(e.is_full_tank) }))
    )

    // Get reminders
    const reminders = db
      .prepare('SELECT * FROM reminders WHERE vehicle_id = ? ORDER BY due_date ASC')
      .all(vehicleId) as Reminder[]

    // Build timeline
    const timeline: Array<{
      type: 'health_scan' | 'document' | 'fuel_entry' | 'reminder'
      date: string
      data: any
    }> = []

    healthScans.forEach((scan) => {
      timeline.push({
        type: 'health_scan',
        date: scan.scan_at,
        data: {
          ...scan,
          warning_lights: Boolean(scan.warning_lights),
          new_noises: Boolean(scan.new_noises),
        },
      })
    })

    documents.forEach((doc) => {
      timeline.push({
        type: 'document',
        date: doc.occurred_at,
        data: doc,
      })
    })

    fuelEntries.forEach((entry) => {
      timeline.push({
        type: 'fuel_entry',
        date: entry.occurred_at,
        data: {
          ...entry,
          is_full_tank: Boolean(entry.is_full_tank),
        },
      })
    })

    reminders.forEach((reminder) => {
      timeline.push({
        type: 'reminder',
        date: reminder.due_date,
        data: {
          ...reminder,
          is_completed: Boolean(reminder.is_completed),
        },
      })
    })

    // Sort timeline by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    res.json({
      vehicle: {
        ...vehicle,
        // Don't expose owner_user_id in public view
        owner_user_id: undefined,
      },
      timeline,
      fuel_stats: fuelStats,
      summary: {
        total_health_scans: healthScans.length,
        total_documents: documents.length,
        total_fuel_entries: fuelEntries.length,
        total_reminders: reminders.length,
      },
    })
  } catch (error) {
    console.error('Get resale pack error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
