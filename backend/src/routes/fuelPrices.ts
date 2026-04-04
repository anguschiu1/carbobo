import { Router } from 'express'
import type { Request, Response as ExpressResponse } from 'express'

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
  distance_km?: number
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

/** Raw entry from the gov.uk CMA open data JSON feed */
interface GovUkStation {
  site_id: string
  brand: string
  address: string
  postcode: string
  location: {
    latitude: number
    longitude: number
  }
  prices: {
    [fuelKey: string]: number // e.g. "E10": 145.9, "B7": 155.9
  }
  last_updated?: string
}

interface GovUkFeedResponse {
  last_updated?: string
  stations: GovUkStation[]
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
 * Gov.uk CMA mandatory fuel price transparency open data feed.
 * Published by DESNZ under the Competition and Markets Authority scheme (2023).
 * No authentication required. Updates approximately every 30 minutes.
 * See: https://www.gov.uk/guidance/access-fuel-price-data
 */
const GOV_UK_FEED_URL = 'https://api.data.gov.uk/fuel-prices/opendata'

/** postcodes.io — free, no-auth UK postcode geocoding service */
const POSTCODES_IO_URL = 'https://api.postcodes.io/postcodes'

/** The gov.uk feed uses these fuel key names */
const FUEL_KEY_MAP: Record<string, string> = {
  petrol: 'E10',   // standard petrol (10% ethanol blend)
  diesel: 'B7',    // standard diesel (7% FAME blend)
  'super-unleaded': 'E5',
  lpg: 'SDV',
}

const FETCH_TIMEOUT_MS = 5_000

/** Cache TTL for the gov.uk prices feed: 30 minutes */
const PRICES_CACHE_TTL_MS = 30 * 60 * 1_000

/** Cache TTL for postcode geocoding results: 24 hours */
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1_000

// ---------------------------------------------------------------------------
// In-memory caches
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const priceCache = new Map<string, CacheEntry<GovUkFeedResponse>>()
const geocodeCache = new Map<string, CacheEntry<PostcodesIoResult>>()

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
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<FetchResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Haversine great-circle distance between two WGS-84 coordinates.
 * Returns distance in kilometres.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth radius in km
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
 * Allows common formats: SW1A 1AA, SW1A1AA, M1 1AE, etc.
 */
function isValidUkPostcodeFormat(postcode: string): boolean {
  const cleaned = postcode.replace(/\s+/g, '').toUpperCase()
  // Standard UK postcode regex (covers all valid formats)
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(cleaned)
}

/**
 * Geocodes a UK postcode to lat/lon via postcodes.io.
 * Results are cached for 24 hours.
 * Throws an error with a user-friendly message on failure.
 */
async function geocodePostcode(postcode: string): Promise<PostcodesIoResult> {
  const normalised = postcode.replace(/\s+/g, '').toUpperCase()

  const cached = getCached(geocodeCache, normalised)
  if (cached) return cached

  const url = `${POSTCODES_IO_URL}/${encodeURIComponent(normalised)}`
  let response: FetchResponse
  try {
    response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
  } catch (err) {
    throw new Error('Postcode lookup service unavailable')
  }

  if (response.status === 404) {
    throw new Error('Postcode not found')
  }

  if (!response.ok) {
    throw new Error('Postcode lookup service unavailable')
  }

  const body = await response.json() as { status: number; result: { latitude: number; longitude: number; postcode: string } }

  if (!body.result?.latitude || !body.result?.longitude) {
    throw new Error('Postcode not found')
  }

  const result: PostcodesIoResult = {
    latitude: body.result.latitude,
    longitude: body.result.longitude,
    postcode: body.result.postcode,
  }

  setCached(geocodeCache, normalised, result, GEOCODE_CACHE_TTL_MS)
  return result
}

/**
 * Fetches the gov.uk CMA fuel price feed and returns the parsed response.
 * The result is cached for 30 minutes.
 * Returns null if the feed is unavailable or returns unexpected data.
 */
async function fetchGovUkFeed(): Promise<GovUkFeedResponse | null> {
  const CACHE_KEY = 'govuk-feed'

  const cached = getCached(priceCache, CACHE_KEY)
  if (cached) return cached

  let response: FetchResponse
  try {
    response = await fetchWithTimeout(GOV_UK_FEED_URL, FETCH_TIMEOUT_MS)
  } catch (err) {
    console.error('[fuelPrices] Gov.uk feed fetch failed (timeout or network error):', err)
    return null
  }

  if (!response.ok) {
    console.error(`[fuelPrices] Gov.uk feed returned HTTP ${response.status}`)
    return null
  }

  let data: unknown
  try {
    data = await response.json()
  } catch (err) {
    console.error('[fuelPrices] Gov.uk feed returned non-JSON response:', err)
    return null
  }

  // The CMA feed shape: { last_updated: string, stations: GovUkStation[] }
  if (!data || typeof data !== 'object' || !Array.isArray((data as GovUkFeedResponse).stations)) {
    console.error('[fuelPrices] Gov.uk feed returned unexpected shape:', JSON.stringify(data).slice(0, 200))
    return null
  }

  const feedData = data as GovUkFeedResponse
  setCached(priceCache, CACHE_KEY, feedData, PRICES_CACHE_TTL_MS)
  return feedData
}

/**
 * Converts a gov.uk feed station entry to the internal FuelStation shape.
 * Returns null if the station lacks valid location data.
 */
function govUkStationToFuelStation(raw: GovUkStation, feedLastUpdated?: string): FuelStation | null {
  const { location } = raw
  if (
    typeof location?.latitude !== 'number' ||
    typeof location?.longitude !== 'number' ||
    !isFinite(location.latitude) ||
    !isFinite(location.longitude)
  ) {
    return null
  }

  const lastUpdated = raw.last_updated ?? feedLastUpdated ?? new Date().toISOString()

  const prices = Object.entries(raw.prices ?? {}).map(([key, ppl]) => ({
    fuel_type: key,
    price_pence_per_litre: ppl,
    last_updated: lastUpdated,
  }))

  return {
    id: raw.site_id,
    name: raw.address ?? raw.brand,
    brand: raw.brand ?? 'Unknown',
    address: raw.address ?? '',
    postcode: raw.postcode ?? '',
    latitude: location.latitude,
    longitude: location.longitude,
    prices,
  }
}

/**
 * Looks up the price for the requested fuel type from a station's price list.
 * The gov.uk feed uses product codes (E10, B7) rather than plain names, so we
 * accept both the mapped code and the raw fuel_type string.
 */
function stationPriceForFuelType(
  station: FuelStation,
  fuelType: string,
): { price_pence_per_litre: number; last_updated: string } | null {
  const govKey = FUEL_KEY_MAP[fuelType.toLowerCase()]

  const match =
    station.prices.find((p) => p.fuel_type === govKey) ??
    station.prices.find((p) => p.fuel_type.toLowerCase() === fuelType.toLowerCase())

  if (!match) return null
  return { price_pence_per_litre: match.price_pence_per_litre, last_updated: match.last_updated }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * POST /api/fuel-prices/nearby
 *
 * Auth: none required
 *
 * Request body:
 *   postcode   string  — UK postcode (e.g. "SW1A 1AA")
 *   fuel_type  string  — "petrol" | "diesel" | "super-unleaded" | "lpg" (default: "petrol")
 *   radius_km  number  — search radius in km (default: 10, max: 50)
 *
 * Response 200:
 *   {
 *     stations: FuelStationResponse[]  — sorted by price ascending, then distance
 *     postcode: string
 *     fuel_type: string
 *     note?: string
 *   }
 *
 * Response 400: invalid or unknown postcode
 * Response 500: unexpected server error
 */
router.post('/fuel-prices/nearby', async (req: Request, res: ExpressResponse) => {
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
    const radiusKm = Math.min(Math.max(Number(radius_km) || 10, 1), 50)

    // --- Geocode the postcode ---

    let origin: PostcodesIoResult
    try {
      origin = await geocodePostcode(trimmedPostcode)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Postcode lookup failed'
      if (message === 'Postcode not found') {
        return res.status(400).json({ error: 'Postcode not found' })
      }
      // Geocoder unavailable — return empty graceful response
      console.warn('[fuelPrices] Postcode geocode unavailable:', message)
      return res.json({
        stations: [],
        postcode: trimmedPostcode.toUpperCase(),
        fuel_type: normalisedFuelType,
        note: 'Fuel price data temporarily unavailable. Please check back later.',
      })
    }

    // --- Fetch the gov.uk price feed ---

    const feed = await fetchGovUkFeed()

    if (!feed) {
      console.warn('[fuelPrices] Gov.uk feed unavailable — returning empty result')
      return res.json({
        stations: [],
        postcode: origin.postcode,
        fuel_type: normalisedFuelType,
        note: 'Fuel price data temporarily unavailable. Please check back later.',
      })
    }

    // --- Filter, annotate with distance, sort ---

    const nearby: FuelStationResponse[] = []

    for (const raw of feed.stations) {
      const station = govUkStationToFuelStation(raw, feed.last_updated)
      if (!station) continue

      const distanceKm = haversineKm(
        origin.latitude,
        origin.longitude,
        station.latitude,
        station.longitude,
      )

      if (distanceKm > radiusKm) continue

      const priceData = stationPriceForFuelType(station, normalisedFuelType)
      if (!priceData) continue // station doesn't sell the requested fuel type

      nearby.push({
        id: station.id,
        name: station.name,
        brand: station.brand,
        address: station.address,
        postcode: station.postcode,
        price_pence_per_litre: priceData.price_pence_per_litre,
        last_updated: priceData.last_updated,
        distance_km: Math.round(distanceKm * 10) / 10,
      })
    }

    // Sort: cheapest first, then by distance for ties
    nearby.sort((a, b) => {
      const priceDiff = a.price_pence_per_litre - b.price_pence_per_litre
      if (priceDiff !== 0) return priceDiff
      return a.distance_km - b.distance_km
    })

    return res.json({
      stations: nearby,
      postcode: origin.postcode,
      fuel_type: normalisedFuelType,
    })
  } catch (error) {
    console.error('[fuelPrices] Unexpected error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
