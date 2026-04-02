import { Router } from 'express'
import type { Request, Response } from 'express'

const router = Router()

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

/**
 * Stub implementation for UK Fuel Finder API
 * Replace this with actual API integration when API key is available
 */
function getNearbyFuelStations(
  postcode: string,
  fuelType: string = 'petrol',
  radiusKm: number = 10
): FuelStation[] {
  // This is a stub - replace with actual API call
  // UK Fuel Finder API documentation: https://www.gov.uk/guidance/fuel-finder-api
  
  // Example stub data
  return [
    {
      id: '1',
      name: 'Example Station 1',
      brand: 'BP',
      address: '123 High Street',
      postcode: postcode,
      latitude: 51.5074,
      longitude: -0.1278,
      prices: [
        {
          fuel_type: 'petrol',
          price_pence_per_litre: 145.9,
          last_updated: new Date().toISOString(),
        },
        {
          fuel_type: 'diesel',
          price_pence_per_litre: 155.9,
          last_updated: new Date().toISOString(),
        },
      ],
      distance_km: 2.5,
    },
    {
      id: '2',
      name: 'Example Station 2',
      brand: 'Shell',
      address: '456 Main Road',
      postcode: postcode,
      latitude: 51.5174,
      longitude: -0.1378,
      prices: [
        {
          fuel_type: 'petrol',
          price_pence_per_litre: 144.9,
          last_updated: new Date().toISOString(),
        },
        {
          fuel_type: 'diesel',
          price_pence_per_litre: 154.9,
          last_updated: new Date().toISOString(),
        },
      ],
      distance_km: 3.8,
    },
  ]
}

/**
 * Get nearby fuel prices
 * POST /api/fuel-prices/nearby
 * Body: { postcode: string, fuel_type?: string, radius_km?: number }
 */
router.post('/fuel-prices/nearby', (req: Request, res: Response) => {
  try {
    const { postcode, fuel_type = 'petrol', radius_km = 10 } = req.body

    if (!postcode) {
      return res.status(400).json({ error: 'Postcode is required' })
    }

    // TODO: Replace with actual UK Fuel Finder API integration
    // The API requires OAuth 2.0 client credentials flow
    // See: https://www.gov.uk/guidance/fuel-finder-api
    
    const apiKey = process.env.FUEL_FINDER_API_KEY
    
    if (!apiKey) {
      // Return stub data for development
      console.warn('FUEL_FINDER_API_KEY not set - returning stub data')
      const stations = getNearbyFuelStations(postcode, fuel_type, radius_km)

      // Sort by price for selected fuel type
      const sortedStations = stations
        .map((station) => {
          const price = station.prices.find((p) => p.fuel_type === fuel_type)
          return {
            ...station,
            price_pence_per_litre: price?.price_pence_per_litre || 0,
            last_updated: price?.last_updated || new Date().toISOString(),
          }
        })
        .filter((station) => station.price_pence_per_litre > 0)
        .sort((a, b) => a.price_pence_per_litre - b.price_pence_per_litre)

      return res.json({
        stations: sortedStations,
        postcode,
        fuel_type,
        note: 'Stub data - API key not configured',
      })
    }

    // TODO: Implement actual API call when FUEL_FINDER_API_KEY is set.
    // For now, return stub
    const stations = getNearbyFuelStations(postcode, fuel_type, radius_km)
    const sortedStations = stations
      .map((station) => {
        const price = station.prices.find((p) => p.fuel_type === fuel_type)
        return {
          ...station,
          price_pence_per_litre: price?.price_pence_per_litre || 0,
          last_updated: price?.last_updated || new Date().toISOString(),
        }
      })
      .filter((station) => station.price_pence_per_litre > 0)
      .sort((a, b) => a.price_pence_per_litre - b.price_pence_per_litre)

    res.json({ stations: sortedStations, postcode, fuel_type })
  } catch (error) {
    console.error('Get fuel prices error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
