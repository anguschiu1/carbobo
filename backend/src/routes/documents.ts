import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/index.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { uploadDocument, getFileUrl } from '../utils/fileUpload.js'
import type { Document } from '@carbobo/shared'

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

// Upload document
router.post('/:vehicleId/documents', uploadDocument.single('file'), (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const vehicleId = req.params.vehicleId

    if (!verifyVehicleOwnership(userId, vehicleId)) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ error: 'File is required' })
    }

    const { type, occurred_at, notes } = req.body

    if (!type || !occurred_at) {
      return res.status(400).json({ error: 'Type and occurred_at are required' })
    }

    const fileUrl = getFileUrl(file.filename, 'documents')
    const docId = uuidv4()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO documents (
        id, vehicle_id, type, file_url, occurred_at, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(docId, vehicleId, type, fileUrl, occurred_at, notes || null, now)

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as Document

    res.status(201).json({ document })
  } catch (error) {
    console.error('Upload document error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get documents for vehicle
router.get('/:vehicleId/documents', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const vehicleId = req.params.vehicleId

    if (!verifyVehicleOwnership(userId, vehicleId)) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    const documents = db
      .prepare('SELECT * FROM documents WHERE vehicle_id = ? ORDER BY occurred_at DESC')
      .all(vehicleId) as Document[]

    res.json({ documents })
  } catch (error) {
    console.error('Get documents error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get single document (serve file)
router.get('/:vehicleId/documents/:docId', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const vehicleId = req.params.vehicleId
    const docId = req.params.docId

    if (!verifyVehicleOwnership(userId, vehicleId)) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    const document = db
      .prepare('SELECT * FROM documents WHERE id = ? AND vehicle_id = ?')
      .get(docId, vehicleId) as Document | undefined

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // File is served statically via /uploads route
    res.json({ document })
  } catch (error) {
    console.error('Get document error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete document
router.delete('/:vehicleId/documents/:docId', (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const vehicleId = req.params.vehicleId
    const docId = req.params.docId

    if (!verifyVehicleOwnership(userId, vehicleId)) {
      return res.status(404).json({ error: 'Vehicle not found' })
    }

    const result = db
      .prepare('DELETE FROM documents WHERE id = ? AND vehicle_id = ?')
      .run(docId, vehicleId)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Document not found' })
    }

    res.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Delete document error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
