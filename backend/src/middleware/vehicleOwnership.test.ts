import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { getDatabase } from '../db/index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function registerAndLogin(email: string, password: string): Promise<string> {
  await request(app)
    .post('/api/auth/register')
    .send({ email, password })
    .expect(201)

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200)

  return res.body.token as string
}

async function createVehicle(token: string): Promise<string> {
  const res = await request(app)
    .post('/api/vehicles')
    .set('Authorization', `Bearer ${token}`)
    .send({ make: 'Ford', model: 'Focus', fuel_type_default: 'petrol', odometer_unit_default: 'miles' })
    .expect(201)

  return res.body.vehicle.id as string
}

// ---------------------------------------------------------------------------
// Tests for verifyVehicleOwnership middleware
// (exercised via the fuel route which uses it)
// ---------------------------------------------------------------------------

describe('verifyVehicleOwnership middleware', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM fuel_entries').run()
    db.prepare('DELETE FROM vehicles').run()
    db.prepare('DELETE FROM users').run()
  })

  it('should return 404 when the vehicle does not exist', async () => {
    const token = await registerAndLogin('owner@example.com', 'password123')

    await request(app)
      .get('/api/vehicles/non-existent-vehicle-id/fuel')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  it('should return 404 when vehicle belongs to a different user', async () => {
    // User A creates a vehicle
    const tokenA = await registerAndLogin('userA@example.com', 'passwordA')
    const vehicleIdA = await createVehicle(tokenA)

    // User B tries to access User A's vehicle
    const tokenB = await registerAndLogin('userB@example.com', 'passwordB')

    await request(app)
      .get(`/api/vehicles/${vehicleIdA}/fuel`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)
  })

  it('should return 401 when no Authorization header is provided', async () => {
    await request(app)
      .get('/api/vehicles/any-vehicle-id/fuel')
      .expect(401)
  })
})
