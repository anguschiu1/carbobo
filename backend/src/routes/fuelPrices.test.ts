/**
 * Tests for POST /api/fuel-prices/nearby
 *
 * The route calls three external services:
 *   1. fuel-finder.service.gov.uk/api/v1/oauth/generate_access_token  (OAuth2 token)
 *   2. fuel-finder.service.gov.uk/api/v1/pfs                          (station list)
 *   3. fuel-finder.service.gov.uk/api/v1/pfs/fuel-prices               (price list)
 *   4. api.postcodes.io/postcodes/:postcode                             (geocoding)
 *
 * All external calls are stubbed via vi.stubGlobal('fetch', ...).
 *
 * NOTE: The route is documented as "Auth: none required" but all /api/* requests
 * pass through reminderRoutes which applies authenticateToken globally.  Every
 * test therefore carries a valid JWT obtained in beforeAll.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { getDatabase } from '../db/index.js'
import { clearCachesForTesting } from './fuelPrices.js'

// ---------------------------------------------------------------------------
// Env vars — ensure credentials are set so the route doesn't short-circuit
// ---------------------------------------------------------------------------

const ORIG_CLIENT_ID     = process.env.FUEL_FINDER_CLIENT_ID
const ORIG_CLIENT_SECRET = process.env.FUEL_FINDER_CLIENT_SECRET

beforeAll(() => {
  process.env.FUEL_FINDER_CLIENT_ID     = 'test-client-id'
  process.env.FUEL_FINDER_CLIENT_SECRET = 'test-client-secret'
})

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_GEOCODE_RESULT = {
  status: 200,
  result: { latitude: 51.5014, longitude: -0.1419, postcode: 'SW1A 1AA' },
}

const MOCK_TOKEN_RESPONSE = {
  access_token: 'mock-bearer-token',
  expires_in: 3600,
  token_type: 'Bearer',
}

/**
 * Three stations at varying distances from origin (51.5014, -0.1419):
 *
 *  Station A — ~0.10 km — petrol (E10) 149.9 p/L, diesel (B7) 160.9 p/L
 *  Station B — ~1.20 km — petrol (E10) 145.9 p/L, diesel (B7) 156.9 p/L
 *  Station C — ~0.61 km — petrol (E10) 155.9 p/L, diesel (B7) 165.9 p/L
 */
const MOCK_STATIONS = [
  {
    site_id: 'station-a',
    brand: 'Shell',
    trading_name: 'Shell The Mall',
    address: '1 The Mall, London',
    postcode: 'SW1A 2AP',
    latitude: 51.5023,
    longitude: -0.1421,
  },
  {
    site_id: 'station-b',
    brand: 'BP',
    trading_name: 'BP Whitehall',
    address: '2 Whitehall, London',
    postcode: 'SW1A 2HE',
    latitude: 51.5040,
    longitude: -0.1250,
  },
  {
    site_id: 'station-c',
    brand: 'Esso',
    trading_name: 'Esso Victoria',
    address: '3 Victoria Street, London',
    postcode: 'SW1H 0ET',
    latitude: 51.4975,
    longitude: -0.1357,
  },
]

const MOCK_PRICES = [
  {
    site_id: 'station-a',
    prices: {
      E10: { price: 149.9, last_updated: '2026-04-04T09:00:00Z' },
      B7:  { price: 160.9, last_updated: '2026-04-04T09:00:00Z' },
    },
  },
  {
    site_id: 'station-b',
    prices: {
      E10: { price: 145.9, last_updated: '2026-04-04T09:00:00Z' },
      B7:  { price: 156.9, last_updated: '2026-04-04T09:00:00Z' },
    },
  },
  {
    site_id: 'station-c',
    prices: {
      E10: { price: 155.9, last_updated: '2026-04-04T09:00:00Z' },
      B7:  { price: 165.9, last_updated: '2026-04-04T09:00:00Z' },
    },
  },
]

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function mockJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

/**
 * Stubs global fetch to return mocks for all three Fuel Finder API calls +
 * postcodes.io.  Individual responses can be overridden via `overrides`.
 */
function setupFetchMock(overrides?: {
  geocodeStatus?: number
  geocodeBody?: unknown
  tokenStatus?: number
  tokenBody?: unknown
  stationsStatus?: number
  stationsBody?: unknown
  pricesStatus?: number
  pricesBody?: unknown
}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url)

      if (u.includes('postcodes.io')) {
        return mockJsonResponse(
          overrides?.geocodeBody  ?? MOCK_GEOCODE_RESULT,
          overrides?.geocodeStatus ?? 200,
        )
      }

      if (u.includes('oauth') || u.includes('generate_access_token')) {
        return mockJsonResponse(
          overrides?.tokenBody  ?? MOCK_TOKEN_RESPONSE,
          overrides?.tokenStatus ?? 200,
        )
      }

      if (u.includes('/api/v1/pfs/fuel-prices')) {
        return mockJsonResponse(
          overrides?.pricesBody  ?? MOCK_PRICES,
          overrides?.pricesStatus ?? 200,
        )
      }

      if (u.includes('/api/v1/pfs')) {
        return mockJsonResponse(
          overrides?.stationsBody  ?? MOCK_STATIONS,
          overrides?.stationsStatus ?? 200,
        )
      }

      throw new Error(`Unexpected fetch call to: ${u}`)
    }),
  )
}

// ---------------------------------------------------------------------------
// Auth helper
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
    // Restore env vars in case a test changed them
    process.env.FUEL_FINDER_CLIENT_ID     = 'test-client-id'
    process.env.FUEL_FINDER_CLIENT_SECRET = 'test-client-secret'
  })

  // -------------------------------------------------------------------------
  // Input validation
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
  // Successful responses
  // -------------------------------------------------------------------------

  describe('successful responses', () => {
    beforeEach(() => setupFetchMock())

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
  // Response shape
  // -------------------------------------------------------------------------

  describe('response shape', () => {
    beforeEach(() => setupFetchMock())

    it('should include all required fields on each station object', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'petrol', radius_km: 50 })
        .expect(200)

      expect(Array.isArray(res.body.stations)).toBe(true)
      expect(res.body.stations.length).toBeGreaterThan(0)

      for (const station of res.body.stations as Record<string, unknown>[]) {
        expect(typeof station.id).toBe('string')
        expect(typeof station.name).toBe('string')
        expect(typeof station.brand).toBe('string')
        expect(typeof station.address).toBe('string')
        expect(typeof station.postcode).toBe('string')
        expect(typeof station.price_pence_per_litre).toBe('number')
        expect(station.price_pence_per_litre as number).toBeGreaterThan(0)
        expect(typeof station.last_updated).toBe('string')
        expect(typeof station.distance_km).toBe('number')
        expect(station.distance_km as number).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Sorting — cheapest first
  // -------------------------------------------------------------------------

  describe('sorting', () => {
    beforeEach(() => setupFetchMock())

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
      expect(stations[0].id).toBe('station-b')
      expect(stations[0].price_pence_per_litre).toBe(145.9)
    })
  })

  // -------------------------------------------------------------------------
  // Radius filtering
  //
  // Station distances from origin (51.5014, -0.1419):
  //   station-a  ~0.10 km
  //   station-c  ~0.61 km
  //   station-b  ~1.20 km
  //
  // radius_km 1.1 → includes A and C, excludes B
  // -------------------------------------------------------------------------

  describe('radius filtering', () => {
    beforeEach(() => setupFetchMock())

    it('should exclude stations beyond the requested radius_km', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'petrol', radius_km: 1.1 })
        .expect(200)

      const ids = (res.body.stations as { id: string }[]).map((s) => s.id)
      expect(ids).not.toContain('station-b')
      expect(ids).toContain('station-a')
      expect(ids).toContain('station-c')
    })

    it('should include all stations when radius_km is large enough', async () => {
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
  // Graceful degradation
  // -------------------------------------------------------------------------

  describe('graceful degradation', () => {
    it('should return 200 with empty stations and a note when the Fuel Finder API is unavailable', async () => {
      setupFetchMock({
        geocodeBody: {
          status: 200,
          result: { latitude: 51.52, longitude: -0.13, postcode: 'EC1A 1BB' },
        },
        stationsStatus: 503,
        stationsBody: { error: 'Service unavailable' },
      })

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
      setupFetchMock({
        geocodeStatus: 404,
        geocodeBody: { status: 404, error: 'Postcode not found' },
      })

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
          if (String(url).includes('postcodes.io')) throw new Error('Network error')
          return mockJsonResponse(MOCK_TOKEN_RESPONSE)
        }),
      )

      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'B1 1BB', fuel_type: 'petrol', radius_km: 10 })
        .expect(200)

      expect(Array.isArray(res.body.stations)).toBe(true)
      expect(res.body.stations).toHaveLength(0)
      expect(res.body).toHaveProperty('note')
    })

    it('should return 200 with a credentials note when client credentials are not configured', async () => {
      delete process.env.FUEL_FINDER_CLIENT_ID
      delete process.env.FUEL_FINDER_CLIENT_SECRET

      setupFetchMock()

      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'petrol', radius_km: 10 })
        .expect(200)

      expect(res.body.stations).toHaveLength(0)
      expect(res.body.note).toMatch(/credentials/i)
    })
  })

  // -------------------------------------------------------------------------
  // Diesel fuel type
  // -------------------------------------------------------------------------

  describe('diesel fuel type', () => {
    beforeEach(() => setupFetchMock())

    it('should return 200 and diesel prices when fuel_type is diesel', async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'SW1A 1AA', fuel_type: 'diesel', radius_km: 50 })
        .expect(200)

      expect(res.body).toHaveProperty('fuel_type', 'diesel')
      expect(Array.isArray(res.body.stations)).toBe(true)
      expect(res.body.stations.length).toBeGreaterThan(0)

      // All stations in mock data have B7 (diesel) prices
      for (const s of res.body.stations as { price_pence_per_litre: number }[]) {
        expect(s.price_pence_per_litre).toBeGreaterThan(0)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Response meta-fields
  // -------------------------------------------------------------------------

  describe('response meta-fields', () => {
    beforeEach(() => setupFetchMock())

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
