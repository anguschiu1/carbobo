import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/index.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { uploadHealthScanPhotos, getFileUrl } from '../utils/fileUpload.js'
import { generateHealthScanAdvice } from '../services/healthScanAdvice.js'
import type { HealthScan } from '@carbobo/shared'

const router = Router()
const db = getDatabase()

// All routes require authentication
router.use(authenticateToken)

// Helper to verify vehicle ownership
function verifyVehicleOwnership(userId: string, vehicleId: string): boolean {
  const vehicle = db
    .prepare('SELECT id FROM vehicles WHERE id = ? AND owner_user_id = ?')
    .get(vehicleId, userId)
  return !!vehicle
}

// Create health scan with photo uploads
router.post(
  '/:vehicleId/health-scans',
  uploadHealthScanPhotos.fields([
    { name: 'tyre_photo', maxCount: 1 },
    { name: 'exterior_photo', maxCount: 1 },
    { name: 'dashboard_photo', maxCount: 1 },
  ]),
  (req: AuthRequest, res) => {
    try {
      const userId = req.userId!
      const vehicleId = req.params.vehicleId

      if (!verifyVehicleOwnership(userId, vehicleId)) {
        return res.status(404).json({ error: 'Vehicle not found' })
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] }
      const {
        scan_at,
        odometer_reading,
        odometer_unit,
        warning_lights = false,
        new_noises = false,
      } = req.body

      // Get vehicle for default odometer unit
      const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId) as {
        odometer_unit_default: string
      }

      const tyrePhotoFile = files?.tyre_photo?.[0]
      const exteriorPhotoFile = files?.exterior_photo?.[0]
      const dashboardPhotoFile = files?.dashboard_photo?.[0]

      const tyrePhotoUrl = tyrePhotoFile ? getFileUrl(tyrePhotoFile.filename, 'health-scans') : null
      const exteriorPhotoUrl = exteriorPhotoFile
        ? getFileUrl(exteriorPhotoFile.filename, 'health-scans')
        : null
      const dashboardPhotoUrl = dashboardPhotoFile
        ? getFileUrl(dashboardPhotoFile.filename, 'health-scans')
        : null

      // Generate advice
      const advice = generateHealthScanAdvice(
        warning_lights === 'true' || warning_lights === true,
        new_noises === 'true' || new_noises === true,
        parseFloat(odometer_reading),
        (odometer_unit || vehicle.odometer_unit_default) as 'miles' | 'km'
      )

      const scanId = uuidv4()
      const now = new Date().toISOString()

      db.prepare(
        `INSERT INTO health_scans (
          id, vehicle_id, scan_at, tyre_photo_url, exterior_photo_url,
          dashboard_photo_url, odometer_reading, odometer_unit,
          warning_lights, new_noises, generated_advice, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        scanId,
        vehicleId,
        scan_at || now,
        tyrePhotoUrl,
        exteriorPhotoUrl,
        dashboardPhotoUrl,
        odometer_reading,
        odometer_unit || vehicle.odometer_unit_default,
        warning_lights === 'true' || warning_lights === true ? 1 : 0,
        new_noises === 'true' || new_noises === true ? 1 : 0,
        advice,
        now
      )

      const scan = db.prepare('SELECT * FROM health_scans WHERE id = ?').get(scanId) as HealthScan

      res.status(201).json({
        scan: {
          ...scan,
          warning_lights: Boolean(scan.warning_lights),
          new_noises: Boolean(scan.new_noises),
        },
      })
    } catch (error) {
      console.error('Create health scan error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// Get health scans for vehicle
router.get('/:vehicleId/health-scans', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const vehicleId = req.params.vehicleId

    if (!verifyVehicleOwnership(userId, vehicleId)) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    const scans = db
      .prepare('SELECT * FROM health_scans WHERE vehicle_id = ? ORDER BY scan_at DESC')
      .all(vehicleId) as HealthScan[]

    const scansWithBooleans = scans.map((scan) => ({
      ...scan,
      warning_lights: Boolean(scan.warning_lights),
      new_noises: Boolean(scan.new_noises),
    }))

    res.json({ scans: scansWithBooleans })
  } catch (error) {
    console.error('Get health scans error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get single health scan
router.get('/:vehicleId/health-scans/:scanId', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const vehicleId = req.params.vehicleId
    const scanId = req.params.scanId

    if (!verifyVehicleOwnership(userId, vehicleId)) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    const scan = db
      .prepare('SELECT * FROM health_scans WHERE id = ? AND vehicle_id = ?')
      .get(scanId, vehicleId) as HealthScan | undefined

    if (!scan) {
      return res.status(404).json({ error: 'Health scan not found' })
    }

    res.json({
      scan: {
        ...scan,
        warning_lights: Boolean(scan.warning_lights),
        new_noises: Boolean(scan.new_noises),
      },
    })
  } catch (error) {
    console.error('Get health scan error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
