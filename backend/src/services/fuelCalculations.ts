import type { FuelEntry, FuelStats, FuelInterval } from '@carbobo/shared'

const UK_GALLONS_PER_LITRE = 1 / 4.54609

export function calculateMPG(litres: number, distanceMiles: number): number {
  if (litres === 0 || distanceMiles === 0) return 0
  const gallons = litres * UK_GALLONS_PER_LITRE
  return distanceMiles / gallons
}

export function calculateLPer100km(litres: number, distanceKm: number): number {
  if (litres === 0 || distanceKm === 0) return 0
  return (litres / distanceKm) * 100
}

export function calculateCostPerMile(costGbp: number, distanceMiles: number): number {
  if (distanceMiles === 0) return 0
  return costGbp / distanceMiles
}

export function convertMilesToKm(miles: number): number {
  return miles * 1.60934
}

export function convertKmToMiles(km: number): number {
  return km / 1.60934
}

/**
 * Calculate fuel intervals from full tank to full tank
 * Partial fills are accumulated until a full tank completes the interval
 */
export function calculateFuelIntervals(entries: FuelEntry[]): FuelInterval[] {
  if (entries.length < 2) return []

  // Sort entries by occurred_at
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  )

  const intervals: FuelInterval[] = []
  let intervalStart: FuelEntry | null = null
  let accumulatedLitres = 0

  for (let i = 0; i < sortedEntries.length; i++) {
    const entry = sortedEntries[i]

    // Convert odometer reading to miles for consistent calculation
    const odometerMiles =
      entry.odometer_unit === 'miles' ? entry.odometer_reading : convertKmToMiles(entry.odometer_reading)

    if (entry.is_full_tank) {
      if (intervalStart === null) {
        // First full tank - start new interval
        intervalStart = entry
        accumulatedLitres = entry.litres_added
      } else {
        // Complete the interval
        const startOdometerMiles =
          intervalStart.odometer_unit === 'miles'
            ? intervalStart.odometer_reading
            : convertKmToMiles(intervalStart.odometer_reading)

        const distanceMiles = odometerMiles - startOdometerMiles
        const distanceKm = convertMilesToKm(distanceMiles)

        if (distanceMiles > 0 && accumulatedLitres > 0) {
          const mpg = calculateMPG(accumulatedLitres, distanceMiles)
          const lPer100km = calculateLPer100km(accumulatedLitres, distanceKm)
          const intervalCost = sortedEntries
            .slice(
              sortedEntries.indexOf(intervalStart),
              i + 1
            )
            .reduce((sum, e) => sum + e.total_cost_gbp, 0)
          const costPerMile = calculateCostPerMile(intervalCost, distanceMiles)

          intervals.push({
            start_entry: intervalStart,
            end_entry: entry,
            litres_total: accumulatedLitres,
            distance_miles: distanceMiles,
            distance_km: distanceKm,
            mpg,
            l_per_100km: lPer100km,
            cost_per_mile: costPerMile,
            total_cost_gbp: intervalCost,
          })
        }

        // Start new interval
        intervalStart = entry
        accumulatedLitres = entry.litres_added
      }
    } else {
      // Partial fill - accumulate
      accumulatedLitres += entry.litres_added
    }
  }

  return intervals
}

/**
 * Calculate rolling stats from all fuel entries
 */
export function calculateFuelStats(entries: FuelEntry[]): FuelStats {
  if (entries.length === 0) {
    return {}
  }

  const intervals = calculateFuelIntervals(entries)

  if (intervals.length === 0) {
    // No complete intervals yet, return partial stats
    const totalLitres = entries.reduce((sum, e) => sum + e.litres_added, 0)
    const totalCost = entries.reduce((sum, e) => sum + e.total_cost_gbp, 0)

    // Calculate distance from first to last entry
    const sortedEntries = [...entries].sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    )
    const firstEntry = sortedEntries[0]
    const lastEntry = sortedEntries[sortedEntries.length - 1]

    const firstOdometerMiles =
      firstEntry.odometer_unit === 'miles'
        ? firstEntry.odometer_reading
        : convertKmToMiles(firstEntry.odometer_reading)
    const lastOdometerMiles =
      lastEntry.odometer_unit === 'miles'
        ? lastEntry.odometer_reading
        : convertKmToMiles(lastEntry.odometer_reading)

    const distanceMiles = lastOdometerMiles - firstOdometerMiles
    const distanceKm = convertMilesToKm(distanceMiles)

    return {
      total_litres: totalLitres,
      total_cost_gbp: totalCost,
      total_distance_miles: distanceMiles > 0 ? distanceMiles : undefined,
      total_distance_km: distanceKm > 0 ? distanceKm : undefined,
    }
  }

  // Calculate averages from intervals
  const totalDistanceMiles = intervals.reduce((sum, i) => sum + i.distance_miles, 0)
  const totalDistanceKm = intervals.reduce((sum, i) => sum + i.distance_km, 0)
  const totalLitres = intervals.reduce((sum, i) => sum + i.litres_total, 0)
  // Use the per-interval total_cost_gbp already computed in calculateFuelIntervals to avoid
  // double-counting boundary entries (the end_entry of interval N is the start_entry of N+1).
  const totalCost = intervals.reduce((sum, i) => sum + i.total_cost_gbp, 0)

  const rollingMpg = totalDistanceMiles > 0 ? calculateMPG(totalLitres, totalDistanceMiles) : undefined
  const rollingLPer100km = totalDistanceKm > 0 ? calculateLPer100km(totalLitres, totalDistanceKm) : undefined
  const costPerMile = totalDistanceMiles > 0 ? calculateCostPerMile(totalCost, totalDistanceMiles) : undefined

  return {
    rolling_mpg: rollingMpg,
    l_per_100km: rollingLPer100km,
    cost_per_mile: costPerMile,
    total_distance_miles: totalDistanceMiles,
    total_distance_km: totalDistanceKm,
    total_litres: totalLitres,
    total_cost_gbp: totalCost,
  }
}

/**
 * Validate fuel entry
 */
export function validateFuelEntry(
  entry: Partial<FuelEntry>,
  previousEntries: FuelEntry[]
): { valid: boolean; warning?: string } {
  if (!entry.odometer_reading || entry.odometer_reading < 0) {
    return { valid: false, warning: 'Odometer reading must be positive' }
  }

  if (previousEntries.length > 0) {
    const sortedEntries = [...previousEntries].sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    )
    const lastEntry = sortedEntries[sortedEntries.length - 1]

    const lastOdometerMiles =
      lastEntry.odometer_unit === 'miles'
        ? lastEntry.odometer_reading
        : convertKmToMiles(lastEntry.odometer_reading)
    const currentOdometerMiles =
      entry.odometer_unit === 'miles'
        ? entry.odometer_reading!
        : convertKmToMiles(entry.odometer_reading!)

    if (currentOdometerMiles < lastOdometerMiles) {
      return { valid: false, warning: 'Odometer reading must increase' }
    }
  }

  // Check cost/price consistency
  if (entry.total_cost_gbp && entry.price_pence_per_litre && entry.litres_added) {
    const expectedCost = (entry.price_pence_per_litre * entry.litres_added) / 100
    const tolerance = 0.5 // Allow 50p tolerance
    if (Math.abs(entry.total_cost_gbp - expectedCost) > tolerance) {
      return {
        valid: true,
        warning: `Cost (£${entry.total_cost_gbp.toFixed(2)}) doesn't match price (£${expectedCost.toFixed(2)}). Please verify.`,
      }
    }
  }

  return { valid: true }
}
