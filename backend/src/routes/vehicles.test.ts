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

// ---------------------------------------------------------------------------
// POST /api/vehicles
// ---------------------------------------------------------------------------

describe('POST /api/vehicles', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM vehicles').run()
    db.prepare('DELETE FROM users').run()
  })

  it('should return 201 and include tank_size_litres when explicitly provided', async () => {
    const token = await registerAndLogin('vehicles-post-a@example.com', 'password123')

    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'BMW',
        model: '3 Series',
        fuel_type_default: 'petrol',
        odometer_unit_default: 'miles',
        tank_size_litres: 60,
      })
      .expect(201)

    expect(res.body).toHaveProperty('vehicle')
    expect(res.body.vehicle).toHaveProperty('tank_size_litres', 60)
  })

  it('should return 201 and default tank_size_litres to 50 when not provided', async () => {
    const token = await registerAndLogin('vehicles-post-b@example.com', 'password123')

    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'Ford',
        model: 'Focus',
        fuel_type_default: 'petrol',
        odometer_unit_default: 'miles',
      })
      .expect(201)

    expect(res.body).toHaveProperty('vehicle')
    expect(res.body.vehicle).toHaveProperty('tank_size_litres', 50)
  })

  it('should return 201 and default tank_size_litres to 50 when an invalid value is provided', async () => {
    const token = await registerAndLogin('vehicles-post-c@example.com', 'password123')

    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'Honda',
        model: 'Civic',
        fuel_type_default: 'petrol',
        odometer_unit_default: 'miles',
        tank_size_litres: 0,
      })
      .expect(201)

    expect(res.body.vehicle).toHaveProperty('tank_size_litres', 50)
  })

  it('should return 401 when no token is provided', async () => {
    await request(app)
      .post('/api/vehicles')
      .send({
        make: 'Ford',
        model: 'Focus',
        fuel_type_default: 'petrol',
        odometer_unit_default: 'miles',
      })
      .expect(401)
  })
})

// ---------------------------------------------------------------------------
// GET /api/vehicles
// ---------------------------------------------------------------------------

describe('GET /api/vehicles', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM vehicles').run()
    db.prepare('DELETE FROM users').run()
  })

  it('should include tank_size_litres on every vehicle in the response array', async () => {
    const token = await registerAndLogin('vehicles-get-a@example.com', 'password123')

    // Create two vehicles with different tank sizes
    await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'Toyota',
        model: 'Yaris',
        fuel_type_default: 'petrol',
        odometer_unit_default: 'miles',
        tank_size_litres: 42,
      })
      .expect(201)

    await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'Land Rover',
        model: 'Defender',
        fuel_type_default: 'diesel',
        odometer_unit_default: 'miles',
        tank_size_litres: 90,
      })
      .expect(201)

    const res = await request(app)
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(Array.isArray(res.body.vehicles)).toBe(true)
    expect(res.body.vehicles).toHaveLength(2)

    for (const vehicle of res.body.vehicles as Record<string, unknown>[]) {
      expect(vehicle).toHaveProperty('tank_size_litres')
      expect(typeof vehicle.tank_size_litres).toBe('number')
      expect(vehicle.tank_size_litres as number).toBeGreaterThan(0)
    }

    const tankSizes = (res.body.vehicles as { tank_size_litres: number }[]).map(
      (v) => v.tank_size_litres,
    )
    expect(tankSizes).toContain(42)
    expect(tankSizes).toContain(90)
  })

  it('should return 401 when no token is provided', async () => {
    await request(app).get('/api/vehicles').expect(401)
  })

  it('should only return vehicles belonging to the authenticated user', async () => {
    const tokenA = await registerAndLogin('vehicles-get-owner-a@example.com', 'password123')
    const tokenB = await registerAndLogin('vehicles-get-owner-b@example.com', 'password123')

    await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ make: 'Audi', model: 'A4', fuel_type_default: 'petrol', odometer_unit_default: 'miles' })
      .expect(201)

    const res = await request(app)
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200)

    expect(res.body.vehicles).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// GET /api/vehicles/:id
// ---------------------------------------------------------------------------

describe('GET /api/vehicles/:id', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM vehicles').run()
    db.prepare('DELETE FROM users').run()
  })

  it('should return 200 and include tank_size_litres on the vehicle object', async () => {
    const token = await registerAndLogin('vehicles-getone-a@example.com', 'password123')

    const createRes = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'Volkswagen',
        model: 'Golf',
        fuel_type_default: 'petrol',
        odometer_unit_default: 'miles',
        tank_size_litres: 55,
      })
      .expect(201)

    const vehicleId = createRes.body.vehicle.id as string

    const res = await request(app)
      .get(`/api/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body).toHaveProperty('vehicle')
    expect(res.body.vehicle).toHaveProperty('tank_size_litres', 55)
  })

  it('should return 404 when the vehicle does not exist', async () => {
    const token = await registerAndLogin('vehicles-getone-404@example.com', 'password123')

    await request(app)
      .get('/api/vehicles/non-existent-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  it('should return 404 when accessing another user\'s vehicle', async () => {
    const tokenA = await registerAndLogin('vehicles-getone-owner-a@example.com', 'password123')
    const tokenB = await registerAndLogin('vehicles-getone-owner-b@example.com', 'password123')

    const createRes = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ make: 'Skoda', model: 'Octavia', fuel_type_default: 'diesel', odometer_unit_default: 'km' })
      .expect(201)

    const vehicleId = createRes.body.vehicle.id as string

    await request(app)
      .get(`/api/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)
  })
})

// ---------------------------------------------------------------------------
// PUT /api/vehicles/:id
// ---------------------------------------------------------------------------

describe('PUT /api/vehicles/:id', () => {
  beforeEach(() => {
    const db = getDatabase()
    db.prepare('DELETE FROM vehicles').run()
    db.prepare('DELETE FROM users').run()
  })

  it('should return 200 and reflect the updated tank_size_litres value', async () => {
    const token = await registerAndLogin('vehicles-put-a@example.com', 'password123')

    const createRes = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'Nissan',
        model: 'Qashqai',
        fuel_type_default: 'petrol',
        odometer_unit_default: 'miles',
      })
      .expect(201)

    // Default should be 50
    expect(createRes.body.vehicle.tank_size_litres).toBe(50)

    const vehicleId = createRes.body.vehicle.id as string

    const updateRes = await request(app)
      .put(`/api/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tank_size_litres: 70 })
      .expect(200)

    expect(updateRes.body).toHaveProperty('vehicle')
    expect(updateRes.body.vehicle).toHaveProperty('tank_size_litres', 70)
  })

  it('should persist the updated tank_size_litres when the vehicle is fetched afterwards', async () => {
    const token = await registerAndLogin('vehicles-put-b@example.com', 'password123')

    const createRes = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'Mercedes',
        model: 'C-Class',
        fuel_type_default: 'diesel',
        odometer_unit_default: 'miles',
        tank_size_litres: 60,
      })
      .expect(201)

    const vehicleId = createRes.body.vehicle.id as string

    await request(app)
      .put(`/api/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tank_size_litres: 66 })
      .expect(200)

    const getRes = await request(app)
      .get(`/api/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(getRes.body.vehicle).toHaveProperty('tank_size_litres', 66)
  })

  it('should return 404 when updating a vehicle that does not exist', async () => {
    const token = await registerAndLogin('vehicles-put-404@example.com', 'password123')

    await request(app)
      .put('/api/vehicles/non-existent-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ tank_size_litres: 70 })
      .expect(404)
  })

  it('should return 404 when updating another user\'s vehicle', async () => {
    const tokenA = await registerAndLogin('vehicles-put-owner-a@example.com', 'password123')
    const tokenB = await registerAndLogin('vehicles-put-owner-b@example.com', 'password123')

    const createRes = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ make: 'Peugeot', model: '308', fuel_type_default: 'petrol', odometer_unit_default: 'miles' })
      .expect(201)

    const vehicleId = createRes.body.vehicle.id as string

    await request(app)
      .put(`/api/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ tank_size_litres: 45 })
      .expect(404)
  })

  it('should return 400 when the request body contains no fields to update', async () => {
    const token = await registerAndLogin('vehicles-put-empty@example.com', 'password123')

    const createRes = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ make: 'Kia', model: 'Sportage', fuel_type_default: 'petrol', odometer_unit_default: 'miles' })
      .expect(201)

    const vehicleId = createRes.body.vehicle.id as string

    await request(app)
      .put(`/api/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('should return 401 when no token is provided', async () => {
    await request(app)
      .put('/api/vehicles/any-id')
      .send({ tank_size_litres: 50 })
      .expect(401)
  })
})
