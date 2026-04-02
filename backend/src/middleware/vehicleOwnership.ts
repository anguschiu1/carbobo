import { Response, NextFunction } from 'express'
import { getDatabase } from '../db/index.js'
import type { AuthRequest } from './auth.js'

const db = getDatabase()

/**
 * Verify that the authenticated user owns the vehicle identified by `req.params.vehicleId`.
 * Responds 404 if the vehicle does not exist or belongs to a different user.
 *
 * Must be used after `authenticateToken` so that `req.userId` is populated.
 *
 * @example
 * router.get('/:vehicleId/fuel', verifyVehicleOwnership, (req, res) => { ... })
 */
export function verifyVehicleOwnership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const userId = req.userId!
  const vehicleId = req.params.vehicleId

  const vehicle = db
    .prepare('SELECT id FROM vehicles WHERE id = ? AND owner_user_id = ?')
    .get(vehicleId, userId)

  if (!vehicle) {
    res.status(404).json({ error: 'Vehicle not found' })
    return
  }

  next()
}
