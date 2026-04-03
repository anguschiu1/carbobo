import { describe, it, expect } from 'vitest'
import {
  calculateMPG,
  calculateLPer100km,
  calculateCostPerMile,
  convertMilesToKm,
  convertKmToMiles,
  calculateFuelIntervals,
  calculateFuelStats,
  validateFuelEntry,
} from './fuelCalculations.js'
import type { FuelEntry } from '@carbobo/shared'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _seq = 0
function makeEntry(overrides: Partial<FuelEntry> = {}): FuelEntry {
  _seq++
  return {
    id: `entry-${_seq}`,
    vehicle_id: 'vehicle-1',
    occurred_at: `2025-01-${String(_seq).padStart(2, '0')}T12:00:00Z`,
    odometer_reading: 1000 * _seq,
    odometer_unit: 'miles',
    litres_added: 40,
    is_full_tank: true,
    total_cost_gbp: 60,
    price_pence_per_litre: 150,
    fuel_type: 'petrol',
    town_pct: 0,
    notes: undefined,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  _seq = 0
})

// ---------------------------------------------------------------------------
// calculateMPG
// ---------------------------------------------------------------------------

describe('calculateMPG', () => {
  it('uses UK gallons (4.54609 L per gallon)', () => {
    // 45.4609 litres = 10 UK gallons
    // 300 miles / 10 gallons = 30 MPG
    const mpg = calculateMPG(45.4609, 300)
    expect(mpg).toBeCloseTo(30, 1)
  })

  it('does NOT use US gallons (3.78541 L)', () => {
    // If US gallons were used: 45.4609 / 3.78541 = ~12 gallons → 300 / 12 ≠ 30
    const mpg = calculateMPG(45.4609, 300)
    // US-gallon result would be ~25 MPG, not 30
    expect(mpg).not.toBeCloseTo(25, 0)
    expect(mpg).toBeCloseTo(30, 1)
  })

  it('returns 0 when litres is 0', () => {
    expect(calculateMPG(0, 300)).toBe(0)
  })

  it('returns 0 when distance is 0', () => {
    expect(calculateMPG(40, 0)).toBe(0)
  })

  it('gives a reasonable value for a typical petrol car', () => {
    // ~40 MPG is normal for a petrol car
    // 40 litres over 400 miles
    const mpg = calculateMPG(40, 400)
    // 40 L / 4.54609 = ~8.8 gallons → 400 / 8.8 ≈ 45.4 MPG
    expect(mpg).toBeGreaterThan(40)
    expect(mpg).toBeLessThan(60)
  })
})

// ---------------------------------------------------------------------------
// calculateLPer100km
// ---------------------------------------------------------------------------

describe('calculateLPer100km', () => {
  it('calculates correctly for typical values', () => {
    // 40 litres over 500 km → 8 L/100km
    expect(calculateLPer100km(40, 500)).toBeCloseTo(8, 2)
  })

  it('returns 0 when litres is 0', () => {
    expect(calculateLPer100km(0, 500)).toBe(0)
  })

  it('returns 0 when distance is 0', () => {
    expect(calculateLPer100km(40, 0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// calculateCostPerMile
// ---------------------------------------------------------------------------

describe('calculateCostPerMile', () => {
  it('divides cost by distance', () => {
    expect(calculateCostPerMile(100, 200)).toBeCloseTo(0.5, 4)
  })

  it('returns 0 when distance is 0', () => {
    expect(calculateCostPerMile(100, 0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------------------------

describe('unit conversions', () => {
  it('convertMilesToKm is correct', () => {
    expect(convertMilesToKm(100)).toBeCloseTo(160.934, 1)
  })

  it('convertKmToMiles is the inverse of convertMilesToKm', () => {
    expect(convertKmToMiles(convertMilesToKm(100))).toBeCloseTo(100, 5)
  })
})

// ---------------------------------------------------------------------------
// calculateFuelIntervals
// ---------------------------------------------------------------------------

describe('calculateFuelIntervals', () => {
  it('returns empty array when fewer than 2 entries', () => {
    expect(calculateFuelIntervals([])).toEqual([])
    const single = makeEntry({ is_full_tank: true })
    expect(calculateFuelIntervals([single])).toEqual([])
  })

  it('produces one interval for two consecutive full-tank entries', () => {
    const e1 = makeEntry({ odometer_reading: 10000, litres_added: 45, total_cost_gbp: 67.5 })
    const e2 = makeEntry({ odometer_reading: 10300, litres_added: 40, total_cost_gbp: 60 })
    const intervals = calculateFuelIntervals([e1, e2])
    expect(intervals).toHaveLength(1)
    const iv = intervals[0]
    expect(iv.distance_miles).toBeCloseTo(300, 1)
    // litres_total = e1.litres (start entry is counted as accumulated from start)
    // The algorithm seeds accumulatedLitres with the start entry's litres, so
    // a two-entry interval accumulates only the start entry's fuel (e1=45L).
    expect(iv.litres_total).toBeCloseTo(45, 2)
    expect(iv.mpg).toBeGreaterThan(0)
  })

  it('partial fill is accumulated and only counted once a full tank completes the interval', () => {
    // e1: full tank (starts interval)
    // e2: partial fill (accumulated)
    // e3: full tank (completes interval)
    const e1 = makeEntry({ odometer_reading: 0,   litres_added: 50, is_full_tank: true,  total_cost_gbp: 75 })
    const e2 = makeEntry({ odometer_reading: 200, litres_added: 20, is_full_tank: false, total_cost_gbp: 30 })
    const e3 = makeEntry({ odometer_reading: 400, litres_added: 35, is_full_tank: true,  total_cost_gbp: 52.5 })

    const intervals = calculateFuelIntervals([e1, e2, e3])
    // Only one interval (e1 → e3)
    expect(intervals).toHaveLength(1)
    const iv = intervals[0]
    expect(iv.distance_miles).toBeCloseTo(400, 1)
    // litres_total = e1.litres + e2.litres (the algorithm seeds accumulatedLitres at the
    // start entry and accumulates partials; e3 completes but its litres seed the NEXT interval)
    expect(iv.litres_total).toBeCloseTo(70, 2)
  })

  it('multiple partial fills before a full tank are all accumulated', () => {
    const e1 = makeEntry({ odometer_reading: 0,   litres_added: 50, is_full_tank: true,  total_cost_gbp: 75 })
    const e2 = makeEntry({ odometer_reading: 100, litres_added: 10, is_full_tank: false, total_cost_gbp: 15 })
    const e3 = makeEntry({ odometer_reading: 200, litres_added: 10, is_full_tank: false, total_cost_gbp: 15 })
    const e4 = makeEntry({ odometer_reading: 300, litres_added: 15, is_full_tank: true,  total_cost_gbp: 22.5 })

    const intervals = calculateFuelIntervals([e1, e2, e3, e4])
    expect(intervals).toHaveLength(1)
    // litres_total = e1 + e2 + e3 (start seeded with e1; e2,e3 accumulated; e4 closes interval
    // and seeds the next one, not counted in this interval)
    expect(intervals[0].litres_total).toBeCloseTo(70, 2)
    expect(intervals[0].distance_miles).toBeCloseTo(300, 1)
  })

  it('two full-tank intervals each track their own fuel and distance', () => {
    const e1 = makeEntry({ odometer_reading: 0,   litres_added: 50, is_full_tank: true,  total_cost_gbp: 75 })
    const e2 = makeEntry({ odometer_reading: 400, litres_added: 40, is_full_tank: true,  total_cost_gbp: 60 })
    const e3 = makeEntry({ odometer_reading: 800, litres_added: 42, is_full_tank: true,  total_cost_gbp: 63 })

    const intervals = calculateFuelIntervals([e1, e2, e3])
    expect(intervals).toHaveLength(2)
    // Interval 1: seeded with e1.litres=50; e2 closes it (e2 seeds interval 2, not counted here)
    expect(intervals[0].litres_total).toBeCloseTo(50, 2)
    expect(intervals[0].distance_miles).toBeCloseTo(400, 1)
    // Interval 2: seeded with e2.litres=40; e3 closes it
    expect(intervals[1].litres_total).toBeCloseTo(40, 2)
    expect(intervals[1].distance_miles).toBeCloseTo(400, 1)
  })

  it('no intervals when only partials exist (never a full tank)', () => {
    const e1 = makeEntry({ is_full_tank: false })
    const e2 = makeEntry({ is_full_tank: false })
    expect(calculateFuelIntervals([e1, e2])).toHaveLength(0)
  })

  it('no intervals when only one full tank with no preceding full tank', () => {
    const e1 = makeEntry({ is_full_tank: false, odometer_reading: 1000 })
    const e2 = makeEntry({ is_full_tank: true,  odometer_reading: 1200 })
    expect(calculateFuelIntervals([e1, e2])).toHaveLength(0)
  })

  it('odometer readings in km are converted to miles for MPG', () => {
    // 400 km ≈ 248.5 miles
    const e1 = makeEntry({ odometer_reading: 0,   odometer_unit: 'km', litres_added: 50, is_full_tank: true,  total_cost_gbp: 75 })
    const e2 = makeEntry({ odometer_reading: 400, odometer_unit: 'km', litres_added: 40, is_full_tank: true,  total_cost_gbp: 60 })

    const intervals = calculateFuelIntervals([e1, e2])
    expect(intervals).toHaveLength(1)
    // Distance should be ~248.5 miles, not 400
    expect(intervals[0].distance_miles).toBeCloseTo(400 / 1.60934, 0)
    expect(intervals[0].distance_km).toBeCloseTo(400, 0)
  })

  it('entries are sorted by occurred_at before processing', () => {
    // Submit in reverse order; result should be same as chronological
    const e1 = makeEntry({ odometer_reading: 0,   litres_added: 50, is_full_tank: true,  total_cost_gbp: 75,
      occurred_at: '2025-01-01T12:00:00Z' })
    const e2 = makeEntry({ odometer_reading: 400, litres_added: 40, is_full_tank: true,  total_cost_gbp: 60,
      occurred_at: '2025-01-10T12:00:00Z' })

    // Pass in reverse
    const intervals = calculateFuelIntervals([e2, e1])
    expect(intervals).toHaveLength(1)
    expect(intervals[0].distance_miles).toBeCloseTo(400, 1)
  })
})

// ---------------------------------------------------------------------------
// Cost double-counting regression
// ---------------------------------------------------------------------------

describe('cost double-counting regression', () => {
  /**
   * Sequence: full → partial → full → partial → full
   *
   * The start_entry of each interval sets the baseline odometer — its cost is
   * NOT attributed to the interval (it was the fill that ended the previous
   * interval, or the very first fill before tracking began). Only the partial
   * fills + the closing full-tank fill are counted for each interval.
   *
   * 5 entries, each £15 = £75 total paid.
   * e1 is the baseline (not counted in any interval).
   * Interval 1 (e1→e3): e2 + e3 = £15 + £15 = £30
   * Interval 2 (e3→e5): e4 + e5 = £15 + £15 = £30
   * Combined = £60 (e1's £15 is unattributed — it was the starting baseline).
   */
  it('two intervals: boundary entry is excluded from both interval costs', () => {
    const e1 = makeEntry({ odometer_reading: 0,   litres_added: 10, is_full_tank: true,  total_cost_gbp: 15,
      occurred_at: '2025-01-01T12:00:00Z' })
    const e2 = makeEntry({ odometer_reading: 100, litres_added: 10, is_full_tank: false, total_cost_gbp: 15,
      occurred_at: '2025-01-02T12:00:00Z' })
    const e3 = makeEntry({ odometer_reading: 200, litres_added: 10, is_full_tank: true,  total_cost_gbp: 15,
      occurred_at: '2025-01-03T12:00:00Z' })
    const e4 = makeEntry({ odometer_reading: 300, litres_added: 10, is_full_tank: false, total_cost_gbp: 15,
      occurred_at: '2025-01-04T12:00:00Z' })
    const e5 = makeEntry({ odometer_reading: 400, litres_added: 10, is_full_tank: true,  total_cost_gbp: 15,
      occurred_at: '2025-01-05T12:00:00Z' })

    const intervals = calculateFuelIntervals([e1, e2, e3, e4, e5])
    expect(intervals).toHaveLength(2)

    // Interval 1 (e1→e3): [e2, e3] → £15 + £15 = £30 (e1 excluded as baseline)
    expect(intervals[0].total_cost_gbp).toBeCloseTo(30, 2)
    // Interval 2 (e3→e5): [e4, e5] → £15 + £15 = £30 (e3 excluded as start of new interval)
    expect(intervals[1].total_cost_gbp).toBeCloseTo(30, 2)

    // Combined = £60; e1's £15 is the unattributed baseline fill.
    const combinedCost = intervals.reduce((sum, iv) => sum + iv.total_cost_gbp, 0)
    expect(combinedCost).toBeCloseTo(60, 2)
  })

  it('interval cost excludes start_entry, includes partial fills + closing full fill', () => {
    // full(e1) → partial(e2) → full(e3) → full(e4)
    // Interval 1 (e1→e3): [e2, e3] = £30 + £52.5 = £82.5  (e1 excluded)
    // Interval 2 (e3→e4): [e4]     = £57             (e3 excluded as new start)
    const e1 = makeEntry({ odometer_reading: 0,   litres_added: 40, is_full_tank: true,  total_cost_gbp: 60,
      occurred_at: '2025-01-01T12:00:00Z' })
    const e2 = makeEntry({ odometer_reading: 200, litres_added: 20, is_full_tank: false, total_cost_gbp: 30,
      occurred_at: '2025-01-05T12:00:00Z' })
    const e3 = makeEntry({ odometer_reading: 400, litres_added: 35, is_full_tank: true,  total_cost_gbp: 52.5,
      occurred_at: '2025-01-10T12:00:00Z' })
    const e4 = makeEntry({ odometer_reading: 600, litres_added: 38, is_full_tank: true,  total_cost_gbp: 57,
      occurred_at: '2025-01-15T12:00:00Z' })

    const intervals = calculateFuelIntervals([e1, e2, e3, e4])
    expect(intervals).toHaveLength(2)

    expect(intervals[0].total_cost_gbp).toBeCloseTo(82.5, 2)
    expect(intervals[1].total_cost_gbp).toBeCloseTo(57, 2)
  })
})

// ---------------------------------------------------------------------------
// calculateFuelStats
// ---------------------------------------------------------------------------

describe('calculateFuelStats', () => {
  it('returns empty object when entries array is empty', () => {
    expect(calculateFuelStats([])).toEqual({})
  })

  it('returns partial stats when no complete intervals exist', () => {
    const e1 = makeEntry({ odometer_reading: 1000, is_full_tank: false, litres_added: 30, total_cost_gbp: 45 })
    const e2 = makeEntry({ odometer_reading: 1300, is_full_tank: false, litres_added: 20, total_cost_gbp: 30 })

    const stats = calculateFuelStats([e1, e2])
    expect(stats.total_litres).toBeCloseTo(50, 2)
    expect(stats.total_cost_gbp).toBeCloseTo(75, 2)
    expect(stats.total_distance_miles).toBeCloseTo(300, 1)
    expect(stats.rolling_mpg).toBeUndefined()
  })

  it('returns rolling MPG when complete intervals exist', () => {
    const e1 = makeEntry({ odometer_reading: 0,   litres_added: 50, is_full_tank: true, total_cost_gbp: 75 })
    const e2 = makeEntry({ odometer_reading: 400, litres_added: 40, is_full_tank: true, total_cost_gbp: 60 })

    const stats = calculateFuelStats([e1, e2])
    expect(stats.rolling_mpg).toBeDefined()
    expect(stats.rolling_mpg).toBeGreaterThan(0)
    expect(stats.l_per_100km).toBeDefined()
    expect(stats.cost_per_mile).toBeDefined()
  })

  it('total cost is not inflated by boundary double-counting', () => {
    // 3 full-tank entries = 2 intervals; total cost must be the sum of interval 2 and interval 3 fills only
    const e1 = makeEntry({ odometer_reading: 0,   litres_added: 50, is_full_tank: true,  total_cost_gbp: 75,
      occurred_at: '2025-01-01T12:00:00Z' })
    const e2 = makeEntry({ odometer_reading: 400, litres_added: 40, is_full_tank: true,  total_cost_gbp: 60,
      occurred_at: '2025-01-05T12:00:00Z' })
    const e3 = makeEntry({ odometer_reading: 800, litres_added: 42, is_full_tank: true,  total_cost_gbp: 63,
      occurred_at: '2025-01-10T12:00:00Z' })

    const stats = calculateFuelStats([e1, e2, e3])
    // e1 starts interval 1 (not counted); e2 closes interval 1 (counted) and starts interval 2 (not re-counted); e3 closes interval 2 (counted)
    // Expected total cost: £60 + £63 = £123 (NOT £195 = 75+60+63)
    expect(stats.total_cost_gbp).toBeCloseTo(123, 2)
  })
})

// ---------------------------------------------------------------------------
// validateFuelEntry
// ---------------------------------------------------------------------------

describe('validateFuelEntry', () => {
  it('rejects negative odometer reading', () => {
    const result = validateFuelEntry({ odometer_reading: -1, odometer_unit: 'miles' }, [])
    expect(result.valid).toBe(false)
    expect(result.warning).toMatch(/positive/i)
  })

  it('rejects zero odometer reading', () => {
    const result = validateFuelEntry({ odometer_reading: 0, odometer_unit: 'miles' }, [])
    expect(result.valid).toBe(false)
  })

  it('rejects odometer reading lower than previous entry', () => {
    const prev = makeEntry({ odometer_reading: 1000, odometer_unit: 'miles' })
    const result = validateFuelEntry(
      { odometer_reading: 900, odometer_unit: 'miles' },
      [prev]
    )
    expect(result.valid).toBe(false)
    expect(result.warning).toMatch(/increase/i)
  })

  it('accepts equal odometer reading (same mileage, e.g. same day second fill)', () => {
    const prev = makeEntry({ odometer_reading: 1000, odometer_unit: 'miles' })
    const result = validateFuelEntry(
      { odometer_reading: 1000, odometer_unit: 'miles' },
      [prev]
    )
    // Equal is not less-than, so should be valid
    expect(result.valid).toBe(true)
  })

  it('accepts increasing odometer reading', () => {
    const prev = makeEntry({ odometer_reading: 1000, odometer_unit: 'miles' })
    const result = validateFuelEntry(
      { odometer_reading: 1100, odometer_unit: 'miles' },
      [prev]
    )
    expect(result.valid).toBe(true)
  })

  it('compares km entries in miles equivalent when checking order', () => {
    // previous entry 160 km ≈ 99.4 miles; new entry 320 km ≈ 198.8 miles → valid
    const prev = makeEntry({ odometer_reading: 160, odometer_unit: 'km' })
    const result = validateFuelEntry(
      { odometer_reading: 320, odometer_unit: 'km' },
      [prev]
    )
    expect(result.valid).toBe(true)
  })

  it('rejects km entry that goes backward compared to miles previous entry', () => {
    // Previous: 1000 miles; new: 100 km ≈ 62 miles → backwards
    const prev = makeEntry({ odometer_reading: 1000, odometer_unit: 'miles' })
    const result = validateFuelEntry(
      { odometer_reading: 100, odometer_unit: 'km' },
      [prev]
    )
    expect(result.valid).toBe(false)
  })

  it('returns warning (but valid=true) when cost/price are inconsistent', () => {
    const result = validateFuelEntry(
      {
        odometer_reading: 1000,
        odometer_unit: 'miles',
        total_cost_gbp: 100,       // should be ~£60 for 40L at 150p/L
        price_pence_per_litre: 150,
        litres_added: 40,
      },
      []
    )
    expect(result.valid).toBe(true)
    expect(result.warning).toBeDefined()
    expect(result.warning).toMatch(/cost|price/i)
  })
})
