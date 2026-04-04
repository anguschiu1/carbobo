/**
 * Tests for POST /api/fuel-prices/nearby
 *
 * NOTE FOR backend-dev: The fuelPrices route is documented as "Auth: none required",
 * but in practice all requests to /api/* pass through the reminderRoutes router which
 * applies `router.use(authenticateToken)` globally. This means unauthenticated requests
 * to /api/fuel-prices/nearby currently return 401. These tests therefore authenticate
 * with a real token. See TESTABILITY.md recommendation for the fix.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { getDatabase } from '../db/index.js'
import { clearCachesForTesting } from './fuelPrices.js'

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_GEOCODE_RESULT = {
  status: 200,
  result: { latitude: 51.5014, longitude: -0.1419, postcode: 'SW1A 1AA' },
}

/**
 * Three stations at varying distances from origin (51.5014, -0.1419):
 *
 *  Station A — ~0.10 km — petrol 149.9 p/L  (closest, mid-price)
 *  Station B — ~1.20 km — petrol 145.9 p/L  (cheapest, farthest)
 *  Station C — ~0.61 km — petrol 155.9 p/L  (most expensive)
 *
 * The route clamps radius_km to a minimum of 1 km, so to test radius
 * exclusion of station-b a radius of 1.1 km is used: it includes A and C
 * (both within 1.1 km) but excludes B (~1.20 km).
 */
const MOCK_GOV_UK_FEED = {
  last_updated: '2026-04-04T10:00:00Z',
  stations: [
    {
      site_id: 'station-a',
      brand: 'Shell',
      address: '1 The Mall, London',
      postcode: 'SW1A 2AP',
      location: { latitude: 51.5023, longitude: -0.1421 }, // ~0.10 km from origin
      prices: { E10: 149.9, B7: 160.9 },
      last_updated: '2026-04-04T09:00:00Z',
    },
    {
      site_id: 'station-b',
      brand: 'BP',
      address: '2 Whitehall, London',
      postcode: 'SW1A 2HE',
      location: { latitude: 51.5040, longitude: -0.1250 }, // ~1.20 km from origin
      prices: { E10: 145.9, B7: 156.9 },
      last_updated: '2026-04-04T09:00:00Z',
    },
    {
      site_id: 'station-c',
      brand: 'Esso',
      address: '3 Victoria Street, London',
      postcode: 'SW1H 0ET',
      location: { latitude: 51.4975, longitude: -0.1357 }, // ~0.61 km from origin
      prices: { E10: 155.9, B7: 165.9 },
      last_updated: '2026-04-04T09:00:00Z',
    },
  ],
}

/**
 * Returns a minimal mock Response object with the given JSON body and status.
 */
function mockJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

/**
 * Stubs global fetch so that:
 *  - postcodes.io requests return the mock geocode result (or an override)
 *  - api.data.gov.uk requests return the mock feed (or an override)
 */
function setupFetchMock(overrides?: {
  geocodeStatus?: number
  geocodeBody?: unknown
  feedStatus?: number
  feedBody?: unknown
}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const urlStr = String(url)
      if (urlStr.includes('postcodes.io')) {
        const status = overrides?.geocodeStatus ?? 200
        const body = overrides?.geocodeBody ?? MOCK_GEOCODE_RESULT
        return mockJsonResponse(body, status)
      }
      if (urlStr.includes('api.data.gov.uk') || urlStr.includes('fuel-prices')) {
        const status = overrides?.feedStatus ?? 200
        const body = overrides?.feedBody ?? MOCK_GOV_UK_FEED
        return mockJsonResponse(body, status)
      }
      throw new Error(`Unexpected fetch call to: ${urlStr}`)
    }),
  )
}

// ---------------------------------------------------------------------------
// Auth helper — the /api/* mount order causes reminderRoutes auth middleware
// to intercept all /api requests, so every test must carry a valid JWT.
// ---------------------------------------------------------------------------

let authToken: string

beforeAll(async () => {
  const db = getDatabase()
  db.prepare('DELETE FROM users WHERE email = ?').run('fuelprice-test@example.com')

  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'fuelprice-test@example.com', password: 'testpassword123' })

  if (res.status !== 201) {
    throw new Error(`Setup failed: could not register test user (${res.status})`)
  }
  authToken = res.body.token as string
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/fuel-prices/nearby', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    clearCachesForTesting()
  })

  // -------------------------------------------------------------------------
  // Input validation — these never reach the fetch layer
  // -------------------------------------------------------------------------

  describe('input validation', () => {
    it('should return 400 when postcode is missing from the request body', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400)

      expect(res.body).toHaveProperty('error')
      expect(typeof res.body.error).toBe('string')
      expect(res.body.error.length).toBeGreaterThan(0)
    })

    it('should return 400 when postcode is an empty string', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: '   ' })
        .expect(400)

      expect(res.body).toHaveProperty('error')
    })

    it('should return 400 with a clear message when postcode format is invalid', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'NOTAPOSTCODE' })
        .expect(400)

      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toMatch(/invalid.*postcode|postcode.*invalid/i)
    })

    it('should return 400 for a postcode that is too short to be a valid UK format', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'AB' })
        .expect(400)

      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toMatch(/invalid.*postcode|postcode.*invalid/i)
    })

    it('should return 400 for a numeric-only postcode', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: '12345678' })
        .expect(400)

      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toMatch(/invalid.*postcode|postcode.*invalid/i)
    })
  })

  // -------------------------------------------------------------------------
  // Happy path — valid requests with mocked external services
  // -------------------------------------------------------------------------

  describe('successful responses', () => {
    beforeEach(() => {
      setupFetchMock()
    })

    it('should return 200 with stations array and postcode field for a valid request', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'petrol', radius_km: 10 })
        .expect(200)

      expect(res.body).toHaveProperty('stations')
      expect(Array.isArray(res.body.stations)).toBe(true)
      expect(res.body).toHaveProperty('postcode')
      expect(typeof res.body.postcode).toBe('string')
    })

    it('should return 200 and default to petrol when fuel_type is omitted', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA' })
        .expect(200)

      expect(res.body).toHaveProperty('fuel_type', 'petrol')
    })

    it('should return 200 and apply a default radius when radius_km is omitted', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA' })
        .expect(200)

      expect(res.body).toHaveProperty('stations')
      expect(Array.isArray(res.body.stations)).toBe(true)
    })

    it('should accept a postcode without a space and still return 200', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A1AA', fuel_type: 'petrol', radius_km: 10 })
        .expect(200)

      expect(res.body).toHaveProperty('stations')
    })
  })

  // -------------------------------------------------------------------------
  // Response shape for each station
  // -------------------------------------------------------------------------

  describe('response shape', () => {
    beforeEach(() => {
      setupFetchMock()
    })

    it('should include all required fields on each station object', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'petrol', radius_km: 50 })
        .expect(200)

      expect(Array.isArray(res.body.stations)).toBe(true)
      expect(res.body.stations.length).toBeGreaterThan(0)

      for (const station of res.body.stations as Record<string, unknown>[]) {
        expect(station).toHaveProperty('id')
        expect(typeof station.id).toBe('string')

        expect(station).toHaveProperty('name')
        expect(typeof station.name).toBe('string')

        expect(station).toHaveProperty('brand')
        expect(typeof station.brand).toBe('string')

        expect(station).toHaveProperty('address')
        expect(typeof station.address).toBe('string')

        expect(station).toHaveProperty('postcode')
        expect(typeof station.postcode).toBe('string')

        expect(station).toHaveProperty('price_pence_per_litre')
        expect(typeof station.price_pence_per_litre).toBe('number')
        expect(station.price_pence_per_litre as number).toBeGreaterThan(0)

        expect(station).toHaveProperty('last_updated')
        expect(typeof station.last_updated).toBe('string')

        expect(station).toHaveProperty('distance_km')
        expect(typeof station.distance_km).toBe('number')
        expect(station.distance_km as number).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Sorting — cheapest first
  // -------------------------------------------------------------------------

  describe('sorting', () => {
    beforeEach(() => {
      setupFetchMock()
    })

    it('should return stations sorted cheapest first when multiple stations are returned', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'petrol', radius_km: 50 })
        .expect(200)

      const stations = res.body.stations as { price_pence_per_litre: number }[]
      expect(stations.length).toBeGreaterThan(1)

      for (let i = 0; i < stations.length - 1; i++) {
        expect(stations[i].price_pence_per_litre).toBeLessThanOrEqual(
          stations[i + 1].price_pence_per_litre,
        )
      }
    })

    it('should place the station with the lowest price first', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'petrol', radius_km: 50 })
        .expect(200)

      const stations = res.body.stations as { price_pence_per_litre: number; id: string }[]
      expect(stations.length).toBeGreaterThan(0)
      // Station B has the lowest mock petrol price (145.9 p/L via E10 key)
      expect(stations[0].id).toBe('station-b')
      expect(stations[0].price_pence_per_litre).toBe(145.9)
    })
  })

  // -------------------------------------------------------------------------
  // Radius filtering
  //
  // The route clamps radius_km to a minimum of 1 km. Station distances from
  // origin (51.5014, -0.1419) are:
  //   station-a  ~0.10 km
  //   station-c  ~0.61 km
  //   station-b  ~1.20 km
  //
  // A radius_km of 1.1 therefore includes A and C but excludes B.
  // -------------------------------------------------------------------------

  describe('radius filtering', () => {
    beforeEach(() => {
      setupFetchMock()
    })

    it('should exclude stations beyond the requested radius_km', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'petrol', radius_km: 1.1 })
        .expect(200)

      const ids = (res.body.stations as { id: string }[]).map((s) => s.id)
      // station-b (~1.20 km) is beyond the 1.1 km radius and must be absent
      expect(ids).not.toContain('station-b')
      // stations A and C are within 1.1 km and must be present
      expect(ids).toContain('station-a')
      expect(ids).toContain('station-c')
    })

    it('should include all stations when radius_km is large enough to cover all', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'petrol', radius_km: 50 })
        .expect(200)

      const ids = (res.body.stations as { id: string }[]).map((s) => s.id)
      expect(ids).toContain('station-a')
      expect(ids).toContain('station-b')
      expect(ids).toContain('station-c')
    })
  })

  // -------------------------------------------------------------------------
  // Graceful degradation — external service failures
  // -------------------------------------------------------------------------

  describe('graceful degradation', () => {
    it('should return 200 with empty stations and a note when the gov.uk feed is unavailable', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          const urlStr = String(url)
          if (urlStr.includes('postcodes.io')) {
            // Unique postcode so geocode cache from other tests does not interfere
            return mockJsonResponse({
              status: 200,
              result: { latitude: 51.5200, longitude: -0.1300, postcode: 'EC1A 1BB' },
            })
          }
          // Simulate a bad gov.uk feed response
          return mockJsonResponse({ error: 'Service unavailable' }, 503)
        }),
      )

      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'EC1A 1BB', fuel_type: 'petrol', radius_km: 10 })
        .expect(200)

      expect(Array.isArray(res.body.stations)).toBe(true)
      expect(res.body.stations).toHaveLength(0)
      expect(res.body).toHaveProperty('note')
      expect(typeof res.body.note).toBe('string')
    })

    it('should return 400 when postcodes.io returns 404 for an unrecognised postcode', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          const urlStr = String(url)
          if (urlStr.includes('postcodes.io')) {
            return mockJsonResponse({ status: 404, error: 'Postcode not found' }, 404)
          }
          return mockJsonResponse(MOCK_GOV_UK_FEED)
        }),
      )

      // ZZ99 9ZZ passes UK postcode format validation but postcodes.io is mocked to 404
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'ZZ99 9ZZ', fuel_type: 'petrol', radius_km: 10 })
        .expect(400)

      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toMatch(/postcode not found/i)
    })

    it('should return 200 with empty stations and a note when postcodes.io is unreachable', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          const urlStr = String(url)
          if (urlStr.includes('postcodes.io')) {
            throw new Error('Network error')
          }
          return mockJsonResponse(MOCK_GOV_UK_FEED)
        }),
      )

      // Use a unique postcode to avoid the geocode cache
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'B1 1BB', fuel_type: 'petrol', radius_km: 10 })
        .expect(200)

      expect(Array.isArray(res.body.stations)).toBe(true)
      expect(res.body.stations).toHaveLength(0)
      expect(res.body).toHaveProperty('note')
    })
  })

  // -------------------------------------------------------------------------
  // Diesel fuel type
  // -------------------------------------------------------------------------

  describe('diesel fuel type', () => {
    beforeEach(() => {
      setupFetchMock()
    })

    it('should return 200 and diesel prices when fuel_type is diesel', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'diesel', radius_km: 50 })
        .expect(200)

      expect(res.body).toHaveProperty('fuel_type', 'diesel')
      expect(Array.isArray(res.body.stations)).toBe(true)
      // All three mock stations have B7 (diesel) prices
      expect(res.body.stations.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // Response meta-fields
  // -------------------------------------------------------------------------

  describe('response meta-fields', () => {
    beforeEach(() => {
      setupFetchMock()
    })

    it('should include fuel_type in the response body matching the requested type', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'petrol', radius_km: 10 })
        .expect(200)

      expect(res.body).toHaveProperty('fuel_type', 'petrol')
    })

    it('should normalise fuel_type to lowercase in the response', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'PETROL', radius_km: 10 })
        .expect(200)

      expect(res.body.fuel_type).toBe('petrol')
    })
  })
})
