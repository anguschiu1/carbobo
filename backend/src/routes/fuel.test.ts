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
// POST /:vehicleId/fuel
// ---------------------------------------------------------------------------

describe('POST /api/vehicles/:vehicleId/fuel', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM fuel_entries').run()
    db.prepare('DELETE FROM vehicles').run()
    db.prepare('DELETE FROM users').run()
  })

  it('should create a fuel entry and return 201 with correct fields', async () => {
    const token = await registerAndLogin('fuelpost@example.com', 'password123')
    const vehicleId = await createVehicle(token)

    const res = await request(app)
      .post(`/api/vehicles/${vehicleId}/fuel`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        occurred_at: '2025-03-01T10:00:00Z',
        odometer_reading: 10000,
        odometer_unit: 'miles',
        litres_added: 40,
        is_full_tank: true,
        total_cost_gbp: 60,
        price_pence_per_litre: 150,
        fuel_type: 'petrol',
        town_pct: 20,
      })
      .expect(201)

    const entry = res.body.entry
    expect(entry).toHaveProperty('id')
    expect(entry.vehicle_id).toBe(vehicleId)
    expect(entry.odometer_reading).toBe(10000)
    expect(entry.litres_added).toBe(40)
    expect(entry.total_cost_gbp).toBe(60)
    expect(entry.fuel_type).toBe('petrol')
  })
})

// ---------------------------------------------------------------------------
// GET /:vehicleId/fuel/stats — boolean coercion
// ---------------------------------------------------------------------------

describe('GET /api/vehicles/:vehicleId/fuel/stats', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM fuel_entries').run()
    db.prepare('DELETE FROM vehicles').run()
    db.prepare('DELETE FROM users').run()
  })

  it('should return is_full_tank as boolean true (not integer 1) in interval start_entry', async () => {
    const token = await registerAndLogin('boolcoerce@example.com', 'password123')
    const vehicleId = await createVehicle(token)

    // First full-tank entry (seeds the interval)
    await request(app)
      .post(`/api/vehicles/${vehicleId}/fuel`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        occurred_at: '2025-03-01T10:00:00Z',
        odometer_reading: 10000,
        odometer_unit: 'miles',
        litres_added: 50,
        is_full_tank: true,
        total_cost_gbp: 75,
        price_pence_per_litre: 150,
        fuel_type: 'petrol',
      })
      .expect(201)

    // Second full-tank entry (closes the interval)
    await request(app)
      .post(`/api/vehicles/${vehicleId}/fuel`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        occurred_at: '2025-03-15T10:00:00Z',
        odometer_reading: 10400,
        odometer_unit: 'miles',
        litres_added: 40,
        is_full_tank: true,
        total_cost_gbp: 60,
        price_pence_per_litre: 150,
        fuel_type: 'petrol',
      })
      .expect(201)

    const res = await request(app)
      .get(`/api/vehicles/${vehicleId}/fuel/stats`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.intervals).toHaveLength(1)
    expect(res.body.intervals[0].start_entry.is_full_tank).toBe(true)
    expect(res.body.intervals[0].end_entry.is_full_tank).toBe(true)
    // Confirm it is actually a boolean, not the SQLite integer 1
    expect(typeof res.body.intervals[0].start_entry.is_full_tank).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// DELETE /:vehicleId/fuel/:entryId
// ---------------------------------------------------------------------------

describe('DELETE /api/vehicles/:vehicleId/fuel/:entryId', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM fuel_entries').run()
    db.prepare('DELETE FROM vehicles').run()
    db.prepare('DELETE FROM users').run()
  })

  it('should return 404 when the fuel entry does not exist', async () => {
    const token = await registerAndLogin('fueldel@example.com', 'password123')
    const vehicleId = await createVehicle(token)

    await request(app)
      .delete(`/api/vehicles/${vehicleId}/fuel/non-existent-entry-id`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })
})

// ---------------------------------------------------------------------------
// PUT /:vehicleId/fuel/:entryId
// ---------------------------------------------------------------------------

describe('PUT /api/vehicles/:vehicleId/fuel/:entryId', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM fuel_entries').run()
    db.prepare('DELETE FROM vehicles').run()
    db.prepare('DELETE FROM users').run()
  })

  it('should return 400 when an empty body is sent (no fields to update)', async () => {
    const token = await registerAndLogin('fuelput@example.com', 'password123')
    const vehicleId = await createVehicle(token)

    // Create an entry to update
    const createRes = await request(app)
      .post(`/api/vehicles/${vehicleId}/fuel`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        occurred_at: '2025-03-01T10:00:00Z',
        odometer_reading: 10000,
        odometer_unit: 'miles',
        litres_added: 40,
        is_full_tank: true,
        total_cost_gbp: 60,
        price_pence_per_litre: 150,
        fuel_type: 'petrol',
      })
      .expect(201)

    const entryId = createRes.body.entry.id as string

    await request(app)
      .put(`/api/vehicles/${vehicleId}/fuel/${entryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })
})
