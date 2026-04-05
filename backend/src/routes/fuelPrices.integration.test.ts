/**
 * Integration tests for the Fuel Prices feature — these make REAL HTTP requests
 * to external services (api.data.gov.uk and postcodes.io).
 *
 * They are SKIPPED by default to avoid flakiness in CI and in air-gapped
 * environments.  Run them manually when you want to verify the external APIs
 * are reachable and still conform to the expected contract:
 *
 *   INTEGRATION=1 pnpm --filter backend test -- fuelPrices.integration
 *
 * What they verify
 * ----------------
 *  1. postcodes.io   — geocoding a known UK postcode returns valid lat/lon
 *  2. api.data.gov.uk — the CMA open data feed is reachable and returns a
 *                       response with `{ stations: [...] }` containing
 *                       the fields the backend relies on
 *  3. Full end-to-end — POST /api/fuel-prices/nearby with a real postcode
 *                       returns the expected response shape from the live feed
 *
 * NOTE: If the gov.uk feed URL changes, these tests will catch it first.
 * The URL is defined in fuelPrices.ts as GOV_UK_FEED_URL.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { getDatabase } from '../db/index.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RUN_INTEGRATION = process.env.INTEGRATION === '1'

/** Generous timeout for external HTTP calls — 30 seconds */
const EXTERNAL_TIMEOUT_MS = 30_000

/** A real, well-known London postcode used for geocoding tests */
const TEST_POSTCODE = 'SW1A 1AA'

// ---------------------------------------------------------------------------
// Auth setup — the /api/fuel-prices/nearby route requires a valid JWT token
// due to the reminderRoutes auth middleware intercepting all /api/* requests
// ---------------------------------------------------------------------------

let authToken: string

beforeAll(async () => {
  if (!RUN_INTEGRATION) return

  const db = getDatabase()
  db.prepare('DELETE FROM users WHERE email = ?').run('integration-test@carbobo.test')

  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'integration-test@carbobo.test', password: 'integrationtest123' })

  if (res.status !== 201) {
    throw new Error(`Integration test setup failed: auth register returned ${res.status}`)
  }
  authToken = res.body.token as string
})

// ---------------------------------------------------------------------------
// 1. postcodes.io API contract
// ---------------------------------------------------------------------------

describe.skipIf(!RUN_INTEGRATION)('postcodes.io API (live)', () => {
  it(
    'should return lat/lon for a known UK postcode',
    async () => {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${TEST_POSTCODE.replace(/\s+/g, '')}`,
        { signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS) },
      )

      expect(res.ok).toBe(true)
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        status: number
        result: { latitude: number; longitude: number; postcode: string }
      }

      expect(body.status).toBe(200)
      expect(body.result).toBeDefined()
      expect(typeof body.result.latitude).toBe('number')
      expect(typeof body.result.longitude).toBe('number')
      // SW1A 1AA is in central London
      expect(body.result.latitude).toBeGreaterThan(51)
      expect(body.result.latitude).toBeLessThan(52)
      expect(body.result.longitude).toBeGreaterThan(-1)
      expect(body.result.longitude).toBeLessThan(1)
    },
    EXTERNAL_TIMEOUT_MS,
  )

  it(
    'should return 404 for a postcode that does not exist',
    async () => {
      const res = await fetch('https://api.postcodes.io/postcodes/ZZ999ZZ', {
        signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
      })

      expect(res.status).toBe(404)
    },
    EXTERNAL_TIMEOUT_MS,
  )
})

// ---------------------------------------------------------------------------
// 2. gov.uk CMA open data feed contract
// ---------------------------------------------------------------------------

describe.skipIf(!RUN_INTEGRATION)('gov.uk CMA fuel price feed (live)', () => {
  it(
    'should be reachable and return a response with a stations array',
    async () => {
      const res = await fetch('https://api.data.gov.uk/fuel-prices/opendata', {
        signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
      })

      // The feed may require auth (API key) — 401/403 also tells us the URL is correct
      expect([200, 401, 403]).toContain(res.status)

      if (res.ok) {
        const body = (await res.json()) as { stations?: unknown[]; last_updated?: string }
        expect(Array.isArray(body.stations)).toBe(true)

        if (body.stations && body.stations.length > 0) {
          const first = body.stations[0] as Record<string, unknown>

          // Required fields the backend reads
          expect(first).toHaveProperty('site_id')
          expect(first).toHaveProperty('brand')
          expect(first).toHaveProperty('postcode')
          expect(first).toHaveProperty('location')

          const location = first.location as Record<string, unknown>
          expect(typeof location.latitude).toBe('number')
          expect(typeof location.longitude).toBe('number')

          expect(first).toHaveProperty('prices')
          expect(typeof first.prices).toBe('object')
        }
      }
    },
    EXTERNAL_TIMEOUT_MS,
  )
})

// ---------------------------------------------------------------------------
// 3. Full end-to-end: POST /api/fuel-prices/nearby with real external calls
// ---------------------------------------------------------------------------

describe.skipIf(!RUN_INTEGRATION)('POST /api/fuel-prices/nearby (live)', () => {
  it(
    'should return 200 with a valid stations array for a real UK postcode',
    async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: TEST_POSTCODE, fuel_type: 'petrol', radius_km: 5 })
        .timeout(EXTERNAL_TIMEOUT_MS)

      // If external services are unavailable the route returns 200 + empty stations + note
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.stations)).toBe(true)
      expect(res.body).toHaveProperty('postcode')
      expect(res.body).toHaveProperty('fuel_type', 'petrol')

      if (res.body.stations.length > 0) {
        // Verify shape of real station data
        const station = res.body.stations[0] as Record<string, unknown>
        expect(typeof station.id).toBe('string')
        expect(typeof station.name).toBe('string')
        expect(typeof station.brand).toBe('string')
        expect(typeof station.address).toBe('string')
        expect(typeof station.postcode).toBe('string')
        expect(typeof station.price_pence_per_litre).toBe('number')
        expect(station.price_pence_per_litre as number).toBeGreaterThan(0)
        expect(typeof station.distance_km).toBe('number')
        expect(station.distance_km as number).toBeGreaterThanOrEqual(0)

        // Stations must be sorted cheapest-first
        for (let i = 0; i < res.body.stations.length - 1; i++) {
          const a = res.body.stations[i] as { price_pence_per_litre: number }
          const b = res.body.stations[i + 1] as { price_pence_per_litre: number }
          expect(a.price_pence_per_litre).toBeLessThanOrEqual(b.price_pence_per_litre)
        }
      } else {
        // Graceful degradation: external service unavailable
        expect(res.body).toHaveProperty('note')
        expect(typeof res.body.note).toBe('string')
      }
    },
    EXTERNAL_TIMEOUT_MS,
  )

  it(
    'should return 400 for an invalid postcode against the real geocoder',
    async () => {
      const res = await request(app)
        .post('/api/fuel-prices/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ postcode: 'NOTVALID', fuel_type: 'petrol' })
        .timeout(EXTERNAL_TIMEOUT_MS)

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    },
    EXTERNAL_TIMEOUT_MS,
  )
})
