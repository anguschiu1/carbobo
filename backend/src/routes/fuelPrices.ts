import { Router } from 'express'
import type { Request, Response as ExpressResponse } from 'express'
import rateLimit from 'express-rate-limit'

// Alias the Web Fetch API Response to avoid collision with Express Response
type FetchResponse = Awaited<ReturnType<typeof fetch>>

const router = Router()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FuelStation {
  id: string
  name: string
  brand: string
  address: string
  postcode: string
  latitude: number
  longitude: number
  prices: {
    fuel_type: string
    price_pence_per_litre: number
    last_updated: string
  }[]
}

/** Shape returned to the frontend for a single station */
interface FuelStationResponse {
  id: string
  name: string
  brand: string
  address: string
  postcode: string
  price_pence_per_litre: number
  last_updated: string
  distance_km: number
}

/**
 * Station entry from GET /api/v1/pfs
 *
 * Based on the official Fuel Finder developer portal
 * (developer.fuel-finder.service.gov.uk) and third-party integrations.
 */
interface FuelFinderStation {
  site_id: string
  brand?: string
  trading_name?: string
  address?: string
  postcode?: string
  latitude: number
  longitude: number
}

/**
 * Price entry from GET /api/v1/pfs/fuel-prices
 * Each fuel type key (E10, E5, B7, SDV) maps to price + timestamp.
 */
interface FuelFinderPriceEntry {
  site_id: string
  prices: {
    [fuelKey: string]: {
      price: number
      last_updated: string
    }
  }
}

/** postcodes.io response shape */
interface PostcodesIoResult {
  latitude: number
  longitude: number
  postcode: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Official UK Government Fuel Finder API.
 * Introduced by the Motor Fuel Price (Open Data) Regulations 2025, live from
 * February 2026.  Requires OAuth2 client credentials (client_id + client_secret).
 *
 * Developer portal: https://www.developer.fuel-finder.service.gov.uk/
 * Gov.uk guidance:  https://www.gov.uk/guidance/access-the-latest-fuel-prices-and-forecourt-data-via-api-or-email
 *
 * Previous URL (api.data.gov.uk/fuel-prices/opendata) was the old CMA voluntary
 * scheme and is no longer active.
 */
const FUEL_FINDER_BASE_URL = 'https://www.fuel-finder.service.gov.uk'
const TOKEN_PATH     = '/api/v1/oauth/generate_access_token'
const STATIONS_PATH  = '/api/v1/pfs'
const PRICES_PATH    = '/api/v1/pfs/fuel-prices'

/** postcodes.io — free, no-auth UK postcode geocoding service */
const POSTCODES_IO_URL = 'https://api.postcodes.io/postcodes'

/**
 * Fuel type codes used by the official Fuel Finder API.
 *  E10 — standard unleaded petrol (10% ethanol)
 *  E5  — super unleaded (5% ethanol, premium petrol)
 *  B7  — standard diesel (7% FAME biodiesel blend)
 *  SDV — super diesel (premium diesel)
 */
const FUEL_KEY_MAP: Record<string, string> = {
  petrol:          'E10',
  diesel:          'B7',
  'super-unleaded': 'E5',
  'super-diesel':   'SDV',
}

const FETCH_TIMEOUT_MS = 10_000

/** Cache TTL for price data: 30 minutes (API updates ~every 30 min) */
const PRICES_CACHE_TTL_MS = 30 * 60 * 1_000

/** Cache TTL for postcode geocoding: 24 hours */
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1_000

/** OAuth2 access token cache — tokens are typically valid for 1 hour */
const TOKEN_EXPIRY_BUFFER_MS = 60_000  // refresh 60 s before expiry

// ---------------------------------------------------------------------------
// In-memory caches
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/** Joined stations+prices data keyed by fuel type, e.g. "E10" */
const priceCache = new Map<string, CacheEntry<FuelFinderStation[]>>()
const geocodeCache = new Map<string, CacheEntry<PostcodesIoResult>>()

/** In-flight Promise for each fuel type, to prevent thundering-herd cache misses. */
const feedInFlight = new Map<string, Promise<FuelFinderStation[] | null>>()

/** OAuth2 token state */
let cachedToken: { token: string; expiresAt: number } | null = null
let tokenInFlight: Promise<string | null> | null = null

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates an AbortController-based fetch with a timeout.
 * Node 20+ has native fetch; no external dependency required.
 */
async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<FetchResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...(init as object), signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Haversine great-circle distance between two WGS-84 coordinates.
 * Returns distance in kilometres.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

/**
 * Validates a UK postcode format (not a lookup — just format check).
 */
function isValidUkPostcodeFormat(postcode: string): boolean {
  const cleaned = postcode.replace(/\s+/g, '').toUpperCase()
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(cleaned)
}

// ---------------------------------------------------------------------------
// OAuth2 token management
// ---------------------------------------------------------------------------

/**
 * Returns a valid OAuth2 Bearer token for the Fuel Finder API.
 * Tokens are cached in memory and refreshed before expiry.
 * Returns null if credentials are not configured or the token request fails.
 */
async function getAccessToken(): Promise<string | null> {
  const clientId     = process.env.FUEL_FINDER_CLIENT_ID
  const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.warn('[fuelPrices] FUEL_FINDER_CLIENT_ID / FUEL_FINDER_CLIENT_SECRET not set')
    return null
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return cachedToken.token
  }

  // Share in-flight token request to avoid duplicate OAuth calls under load
  if (tokenInFlight) return tokenInFlight

  tokenInFlight = (async () => {
    try {
      const params = new URLSearchParams()
      params.set('client_id', clientId)
      params.set('client_secret', clientSecret)
      params.set('grant_type', 'client_credentials')

      const res = await fetchWithTimeout(
        `${FUEL_FINDER_BASE_URL}${TOKEN_PATH}`,
        FETCH_TIMEOUT_MS,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
          body: params.toString(),
        } as RequestInit,
      )

      const rawBody = await res.text()

      if (!res.ok) {
        console.error(`[fuelPrices] OAuth token request failed: HTTP ${res.status} — ${rawBody}`)
        return null
      }

      let body: { success?: boolean; data?: { access_token?: string; expires_in?: number; token_type?: string } }
      try {
        body = JSON.parse(rawBody)
      } catch {
        console.error('[fuelPrices] OAuth response is not valid JSON:', rawBody)
        return null
      }

      const tokenData = body.data
      if (!tokenData?.access_token) {
        console.error('[fuelPrices] OAuth response missing access_token:', rawBody)
        return null
      }

      const expiresInMs = (tokenData.expires_in ?? 3600) * 1000
      cachedToken = { token: tokenData.access_token, expiresAt: Date.now() + expiresInMs }
      return cachedToken.token
    } catch (err) {
      console.error('[fuelPrices] OAuth token fetch error:', err)
      return null
    }
  })().finally(() => { tokenInFlight = null })

  return tokenInFlight
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

/**
 * Geocodes a UK postcode to lat/lon via postcodes.io.
 * Results are cached for 24 hours.
 */
async function geocodePostcode(postcode: string): Promise<PostcodesIoResult> {
  const normalised = postcode.replace(/\s+/g, '').toUpperCase()

  const cached = getCached(geocodeCache, normalised)
  if (cached) return cached

  const url = `${POSTCODES_IO_URL}/${encodeURIComponent(normalised)}`
  let response: FetchResponse
  try {
    response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
  } catch {
    throw new Error('Postcode lookup service unavailable')
  }

  if (response.status === 404) throw new Error('Postcode not found')
  if (!response.ok)            throw new Error('Postcode lookup service unavailable')

  const body = await response.json() as {
    status: number
    result?: { latitude: number; longitude: number; postcode: string }
  }

  if (body.result?.latitude == null || body.result?.longitude == null) {
    throw new Error('Postcode not found')
  }

  const result: PostcodesIoResult = {
    latitude:  body.result.latitude,
    longitude: body.result.longitude,
    postcode:  body.result.postcode,
  }

  setCached(geocodeCache, normalised, result, GEOCODE_CACHE_TTL_MS)

  if (geocodeCache.size > 10_000) {
    const firstKey = geocodeCache.keys().next().value
    if (firstKey !== undefined) geocodeCache.delete(firstKey)
  }

  return result
}

// ---------------------------------------------------------------------------
// Fuel Finder API fetch
// ---------------------------------------------------------------------------

/**
 * Fetches stations and their prices from the official Fuel Finder API,
 * joining the two endpoints on site_id.
 *
 * The joined list is cached per fuel-type key for 30 minutes.
 * Concurrent cache-miss callers share one outbound pair of requests.
 *
 * Returns null if credentials are missing or the API is unavailable.
 */
async function fetchFuelFinderData(fuelKey: string): Promise<FuelFinderStation[] | null> {
  const cacheKey = `fuel-finder-${fuelKey}`

  const cached = getCached(priceCache, cacheKey)
  if (cached) return cached

  const existing = feedInFlight.get(cacheKey)
  if (existing) return existing

  const inFlight = (async (): Promise<FuelFinderStation[] | null> => {
    const token = await getAccessToken()
    if (!token) return null

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'User-Agent': 'Carbobo/1.0 (+https://github.com/anguschiu1/carbobo)',
    }

    let stationsRes: FetchResponse, pricesRes: FetchResponse
    try {
      ;[stationsRes, pricesRes] = await Promise.all([
        fetchWithTimeout(`${FUEL_FINDER_BASE_URL}${STATIONS_PATH}`, FETCH_TIMEOUT_MS, { headers } as RequestInit),
        fetchWithTimeout(`${FUEL_FINDER_BASE_URL}${PRICES_PATH}`,   FETCH_TIMEOUT_MS, { headers } as RequestInit),
      ])
    } catch (err) {
      console.error('[fuelPrices] Fuel Finder API fetch error:', err)
      return null
    }

    if (!stationsRes.ok || !pricesRes.ok) {
      console.error(`[fuelPrices] Fuel Finder API returned HTTP ${stationsRes.status} / ${pricesRes.status}`)
      return null
    }

    let stations: FuelFinderStation[], priceEntries: FuelFinderPriceEntry[]
    try {
      stations     = (await stationsRes.json()) as FuelFinderStation[]
      priceEntries = (await pricesRes.json())   as FuelFinderPriceEntry[]
    } catch (err) {
      console.error('[fuelPrices] Fuel Finder API returned non-JSON response:', err)
      return null
    }

    if (!Array.isArray(stations) || !Array.isArray(priceEntries)) {
      console.error('[fuelPrices] Fuel Finder API returned unexpected shape')
      return null
    }

    // Build a price lookup map: site_id → price entry
    const priceMap = new Map<string, FuelFinderPriceEntry>()
    for (const entry of priceEntries) {
      if (entry.site_id) priceMap.set(entry.site_id, entry)
    }

    // Merge price data into station records (filter to stations that have this fuel type)
    const merged: FuelFinderStation[] = []
    for (const station of stations) {
      const priceData = priceMap.get(station.site_id)
      if (!priceData?.prices?.[fuelKey]) continue
      // Attach prices to the station object for use downstream
      ;(station as FuelFinderStation & { _prices?: FuelFinderPriceEntry['prices'] })._prices =
        priceData.prices
      merged.push(station)
    }

    setCached(priceCache, cacheKey, merged, PRICES_CACHE_TTL_MS)
    return merged
  })().finally(() => { feedInFlight.delete(cacheKey) })

  feedInFlight.set(cacheKey, inFlight)
  return inFlight
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

/**
 * Rate limiter for the fuel-prices/nearby endpoint.
 * Unauthenticated public route that calls two external APIs — limit to
 * 30 requests per minute per IP to guard against abuse and API quota exhaustion.
 */
const fuelPricesLimiter = rateLimit({
  windowMs: 60 * 1_000,   // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait before searching again.' },
})

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * POST /api/fuel-prices/nearby
 *
 * Auth: none required (public endpoint)
 *
 * Request body:
 *   postcode   string  — UK postcode (e.g. "SW1A 1AA")
 *   fuel_type  string  — "petrol" | "diesel" | "super-unleaded" | "super-diesel"
 *                        (default: "petrol")
 *   radius_km  number  — search radius in km (default: 10, min: 0.1, max: 50)
 *
 * Response 200:
 *   {
 *     stations:  FuelStationResponse[]  — sorted cheapest first, then by distance
 *     postcode:  string
 *     fuel_type: string
 *     note?:     string                  — present when data is temporarily unavailable
 *   }
 *
 * Response 400: invalid or unknown postcode
 * Response 500: unexpected server error
 *
 * Requires env vars: FUEL_FINDER_CLIENT_ID, FUEL_FINDER_CLIENT_SECRET
 * Obtain credentials at: https://www.developer.fuel-finder.service.gov.uk/
 */
router.post('/fuel-prices/nearby', fuelPricesLimiter, async (req: Request, res: ExpressResponse) => {
  try {
    const { postcode, fuel_type = 'petrol', radius_km = 10 } = req.body as {
      postcode?: string
      fuel_type?: string
      radius_km?: number
    }

    // --- Input validation ---

    if (!postcode || typeof postcode !== 'string' || postcode.trim() === '') {
      return res.status(400).json({ error: 'postcode is required' })
    }

    const trimmedPostcode = postcode.trim()

    if (!isValidUkPostcodeFormat(trimmedPostcode)) {
      return res.status(400).json({ error: 'Invalid UK postcode format' })
    }

    const normalisedFuelType = (typeof fuel_type === 'string' ? fuel_type : 'petrol').toLowerCase()
    const radiusKm = Math.min(Math.max(Number(radius_km) || 10, 0.1), 50)

    const fuelKey = FUEL_KEY_MAP[normalisedFuelType]

    // --- Geocode the postcode ---

    let origin: PostcodesIoResult
    try {
      origin = await geocodePostcode(trimmedPostcode)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Postcode lookup failed'
      if (message === 'Postcode not found') {
        return res.status(400).json({ error: 'Postcode not found' })
      }
      console.warn('[fuelPrices] Postcode geocode unavailable:', message)
      return res.json({
        stations:  [],
        postcode:  trimmedPostcode.toUpperCase(),
        fuel_type: normalisedFuelType,
        note: 'Fuel price data temporarily unavailable. Please check back later.',
      })
    }

    // --- Fetch Fuel Finder data ---

    const stations = await fetchFuelFinderData(fuelKey ?? normalisedFuelType)

    if (!stations) {
      const note = !process.env.FUEL_FINDER_CLIENT_ID
        ? 'Fuel price API credentials not configured. Set FUEL_FINDER_CLIENT_ID and FUEL_FINDER_CLIENT_SECRET.'
        : 'Fuel price data temporarily unavailable. Please check back later.'

      console.warn('[fuelPrices] Fuel Finder data unavailable — returning empty result')
      return res.json({
        stations:  [],
        postcode:  origin.postcode,
        fuel_type: normalisedFuelType,
        note,
      })
    }

    // --- Filter by radius, annotate distance, sort ---

    const nearby: FuelStationResponse[] = []

    for (const station of stations) {
      if (
        typeof station.latitude  !== 'number' || !isFinite(station.latitude)  ||
        typeof station.longitude !== 'number' || !isFinite(station.longitude)
      ) continue

      const distanceKm = haversineKm(
        origin.latitude, origin.longitude,
        station.latitude, station.longitude,
      )

      if (distanceKm > radiusKm) continue

      const pricesData = (station as FuelFinderStation & {
        _prices?: FuelFinderPriceEntry['prices']
      })._prices

      const priceEntry = pricesData?.[fuelKey ?? normalisedFuelType]
      if (!priceEntry) continue

      nearby.push({
        id:                    station.site_id,
        name:                  station.trading_name ?? station.address ?? station.brand ?? 'Unknown',
        brand:                 station.brand ?? 'Unknown',
        address:               station.address ?? '',
        postcode:              station.postcode ?? '',
        price_pence_per_litre: priceEntry.price,
        last_updated:          priceEntry.last_updated,
        distance_km:           Math.round(distanceKm * 10) / 10,
      })
    }

    // Sort cheapest first, then by distance for ties
    nearby.sort((a, b) => {
      const priceDiff = a.price_pence_per_litre - b.price_pence_per_litre
      if (priceDiff !== 0) return priceDiff
      return a.distance_km - b.distance_km
    })

    return res.json({
      stations:  nearby,
      postcode:  origin.postcode,
      fuel_type: normalisedFuelType,
    })
  } catch (error) {
    console.error('[fuelPrices] Unexpected error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Clears all in-memory caches and resets OAuth token state. For use in tests only. */
export function clearCachesForTesting(): void {
  priceCache.clear()
  geocodeCache.clear()
  feedInFlight.clear()
  cachedToken    = null
  tokenInFlight  = null
}

export default router
