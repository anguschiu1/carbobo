<!-- Page: Nearby fuel price lookup by postcode, with cheapest station highlight and API note handling -->
<template>
  <div class="container mx-auto p-4 space-y-6">
    <h1 class="text-3xl font-bold">Nearby Fuel Prices</h1>

    <!-- Search form -->
    <Card class="p-4">
      <form @submit.prevent="handleSearch" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="space-y-2">
            <Label for="postcode">Postcode</Label>
            <!-- Postcode input + geolocation button row -->
            <div class="flex gap-2">
              <Input
                id="postcode"
                v-model="searchForm.postcode"
                placeholder="e.g., SW1A 1AA"
                required
                class="flex-1"
              />
              <!-- Only render if the browser supports geolocation -->
              <Button
                v-if="geolocationSupported"
                type="button"
                variant="outline"
                :disabled="geoLoading"
                aria-label="Use my current location"
                class="shrink-0 px-3"
                @click="useMyLocation"
              >
                <!-- Spinner while locating -->
                <svg
                  v-if="geoLoading"
                  class="animate-spin h-4 w-4 text-muted-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <!-- Location pin icon when idle -->
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-muted-foreground"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clip-rule="evenodd"
                  />
                </svg>
              </Button>
            </div>
            <!-- Inline error for geolocation failures -->
            <p
              v-if="geoError"
              class="text-xs text-destructive mt-1"
              role="alert"
            >
              {{ geoError }}
            </p>
          </div>
          <div class="space-y-2">
            <Label for="fuel_type">Fuel Type</Label>
            <Select id="fuel_type" v-model="searchForm.fuel_type">
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
              <option value="super-unleaded">Super Unleaded</option>
              <option value="super-diesel">Super Diesel</option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="radius">Radius (km)</Label>
            <Input
              id="radius"
              v-model.number="searchForm.radius_km"
              type="number"
              :min="0.1"
              :step="0.1"
              :max="50"
              required
            />
          </div>
        </div>
        <Button type="submit" :disabled="loading || rateLimited" class="w-full md:w-auto">
          {{ loading ? 'Searching...' : rateLimited ? 'Too many requests — wait 30s' : 'Search' }}
        </Button>
      </form>
    </Card>

    <!-- Hard error banner (network failure, 4xx/5xx) -->
    <div
      v-if="error"
      class="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-4 rounded-md"
      role="alert"
    >
      {{ error }}
    </div>

    <!-- API note banner when no stations returned (API not configured / temporarily unavailable) -->
    <div
      v-if="apiNote && stations.length === 0 && !error"
      class="flex items-start gap-3 text-sm bg-amber-50 border border-amber-300 text-amber-800 p-4 rounded-md"
      role="status"
      aria-live="polite"
    >
      <!-- Info icon -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 shrink-0 mt-0.5 text-amber-500"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clip-rule="evenodd"
        />
      </svg>
      <span>{{ apiNote }}</span>
    </div>

    <!-- Loading skeleton — 3 pulsing card placeholders -->
    <div v-if="loading" class="space-y-3" aria-label="Loading fuel stations">
      <div
        v-for="n in 3"
        :key="n"
        class="animate-pulse rounded-lg border bg-card p-4 h-28"
      >
        <div class="flex justify-between items-start gap-4">
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-muted rounded w-2/5"></div>
            <div class="h-3 bg-muted rounded w-1/4"></div>
            <div class="h-3 bg-muted rounded w-3/5"></div>
          </div>
          <div class="space-y-2 text-right">
            <div class="h-7 bg-muted rounded w-20"></div>
            <div class="h-3 bg-muted rounded w-16"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div v-else-if="stations.length > 0" class="space-y-4">
      <p class="text-sm text-muted-foreground">
        Found {{ stations.length }} station{{ stations.length === 1 ? '' : 's' }} near
        {{ lastSearchPostcode }}
      </p>

      <div class="space-y-2">
        <Card
          v-for="(station, index) in stations"
          :key="station.id"
          :class="index === 0
            ? 'p-4 transition-shadow hover:shadow-md border-green-400 bg-green-50/50 dark:bg-green-950/20'
            : 'p-4 transition-shadow hover:shadow-md'"
        >
          <div class="flex justify-between items-start gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-0.5">
                <h3 class="font-semibold text-base leading-tight">{{ station.name }}</h3>
                <!-- Best price badge on the cheapest station -->
                <span
                  v-if="index === 0"
                  class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 border border-green-300 shrink-0"
                >
                  Best price
                </span>
              </div>
              <p class="text-sm text-muted-foreground">{{ station.brand }}</p>
              <p class="text-sm">{{ station.address }}</p>
              <p class="text-sm text-muted-foreground">{{ station.postcode }}</p>
              <p v-if="station.distance_km != null" class="text-xs text-muted-foreground mt-1">
                {{ station.distance_km.toFixed(1) }} km away
              </p>
            </div>

            <div class="text-right shrink-0">
              <p class="text-2xl font-bold leading-none">
                {{ station.price_pence_per_litre.toFixed(1) }}p/L
              </p>
              <!-- Per-tank estimate using vehicle tank size (falls back to 50 L) -->
              <p class="text-xs text-muted-foreground mt-1">
                ~£{{ perTankCost(station.price_pence_per_litre) }} per tank ({{ tankSize }}L)
              </p>
              <!-- Last updated with staleness warning -->
              <p class="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
                <svg
                  v-if="isPriceStale(station.last_updated)"
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3.5 w-3.5 text-amber-500 shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-label="Price data may be outdated"
                >
                  <path
                    fill-rule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
                Updated: {{ safeFormatDate(station.last_updated, 'MMM d, HH:mm') }}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <!-- Subtle API note when stations are present but a note was also returned -->
      <p
        v-if="apiNote && stations.length > 0"
        class="text-xs text-muted-foreground flex items-center gap-1"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5 text-amber-500 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clip-rule="evenodd"
          />
        </svg>
        {{ apiNote }}
      </p>
    </div>

    <!-- Empty state after a completed search with no results and no note -->
    <div
      v-else-if="searched && !loading && !apiNote"
      class="text-center py-12 text-muted-foreground"
    >
      No stations found. Try a different postcode or increase the radius.
    </div>
  </div>
</template>

<script setup lang="ts">
// Page: Fuel Prices — let users search for nearby fuel prices by postcode
import { ref, computed, onMounted } from 'vue'
import { format, differenceInHours, isValid } from 'date-fns'
import axios from 'axios'
import apiClient from '@/api/client'
import { useVehiclesStore } from '@/stores/vehicles'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { FuelType } from '@carbobo/shared'

interface FuelStation {
  id: string
  name: string
  brand: string
  address: string
  postcode: string
  price_pence_per_litre: number
  last_updated: string
  distance_km: number
}

const LAST_POSTCODE_KEY = 'carbobo:last_postcode'

const vehicleStore = useVehiclesStore()

const loading = ref(false)
const rateLimited = ref(false)
// Hard errors only (network failures, 4xx/5xx responses)
const error = ref('')
// Informational API notes (e.g. "data temporarily unavailable")
const apiNote = ref('')
const searched = ref(false)
const stations = ref<FuelStation[]>([])
const lastSearchPostcode = ref('')

// Geolocation state
const geolocationSupported = ref(typeof navigator !== 'undefined' && 'geolocation' in navigator)
const geoLoading = ref(false)
const geoError = ref('')

const searchForm = ref<{
  postcode: string
  fuel_type: string
  radius_km: number
}>({
  postcode: '',
  fuel_type: 'petrol',
  radius_km: 10,
})

/**
 * Computed tank size in litres, using the current vehicle's tank_size_litres if available.
 * Falls back to 50 L as a sensible UK average until the backend field is populated.
 */
const tankSize = computed<number>(() => vehicleStore.currentVehicle?.tank_size_litres ?? 50)

/**
 * Maps a vehicle FuelType to a search form fuel type string.
 * Electric vehicles are excluded (returns null) as they don't use petrol/diesel prices.
 * Hybrid defaults to 'petrol' as petrol hybrids are the most common variant in the UK.
 */
function mapVehicleFuelType(fuelType: FuelType): 'petrol' | 'diesel' | null {
  switch (fuelType) {
    case 'petrol':
      return 'petrol'
    case 'diesel':
      return 'diesel'
    case 'hybrid':
      return 'petrol'
    case 'electric':
      return null
    default:
      return null
  }
}

/**
 * Calculates an estimated cost for a full tank fill at the given price.
 * Uses the current vehicle's tank_size_litres or falls back to 50 L.
 * Returns a string formatted to 2 decimal places (e.g. "72.95").
 */
function perTankCost(pricePencePerLitre: number): string {
  return ((pricePencePerLitre * tankSize.value) / 100).toFixed(2)
}

/**
 * Safely formats a date string using date-fns format.
 * Returns the fallback string (default '—') when the input is not a valid date,
 * preventing RangeError throws from malformed API date strings.
 */
function safeFormatDate(dateStr: string, formatStr: string, fallback = '—'): string {
  const d = new Date(dateStr)
  return isValid(d) ? format(d, formatStr) : fallback
}

/**
 * Returns true when a price's last_updated timestamp is more than 2 hours ago,
 * indicating the data may be stale and should be flagged to the user.
 * Returns false for invalid date strings rather than throwing.
 */
function isPriceStale(lastUpdated: string): boolean {
  const d = new Date(lastUpdated)
  return isValid(d) && differenceInHours(new Date(), d) > 2
}

/**
 * Uses the browser Geolocation API to get the user's coordinates, then
 * reverse-geocodes to the nearest UK postcode via postcodes.io.
 * On success, populates searchForm.postcode.
 * Uses fetch (not the authenticated Axios instance) to avoid sending the Bearer token.
 */
async function useMyLocation(): Promise<void> {
  geoError.value = ''
  geoLoading.value = true

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 10000,
        maximumAge: 60000,
      })
    })

    const { latitude: lat, longitude: lon } = position.coords

    const response = await fetch(
      `https://api.postcodes.io/postcodes?lon=${lon}&lat=${lat}&limit=1`
    )

    if (!response.ok) {
      throw new Error('Postcode lookup failed')
    }

    const data: { result: Array<{ postcode: string }> | null } = await response.json()

    if (data.result && data.result.length > 0) {
      searchForm.value.postcode = data.result[0].postcode
    } else {
      geoError.value = 'Location unavailable'
    }
  } catch (err) {
    const code = (err as GeolocationPositionError).code
    geoError.value = code === 1
      ? 'Location permission denied — enable it in browser settings'
      : 'Location unavailable — try entering your postcode'
  } finally {
    geoLoading.value = false
  }
}

onMounted(() => {
  // Pre-fill fuel type from the current vehicle (before localStorage check so postcode wins)
  const vehicle = vehicleStore.currentVehicle
  if (vehicle) {
    const mapped = mapVehicleFuelType(vehicle.fuel_type_default)
    if (mapped !== null) {
      searchForm.value.fuel_type = mapped
    }
  }

  // Pre-fill postcode from localStorage — takes precedence over any other default
  const savedPostcode = localStorage.getItem(LAST_POSTCODE_KEY)
  if (savedPostcode) {
    searchForm.value.postcode = savedPostcode
  }
})

async function handleSearch() {
  error.value = ''
  apiNote.value = ''
  loading.value = true
  searched.value = true

  try {
    const response = await apiClient.post('/fuel-prices/nearby', {
      postcode: searchForm.value.postcode.toUpperCase().trim(),
      fuel_type: searchForm.value.fuel_type,
      radius_km: searchForm.value.radius_km,
    })

    stations.value = response.data.stations || []
    lastSearchPostcode.value = response.data.postcode || searchForm.value.postcode

    // Persist a successful postcode search to localStorage for next visit
    localStorage.setItem(LAST_POSTCODE_KEY, searchForm.value.postcode.toUpperCase().trim())

    // Treat notes as informational, not errors — displayed as amber banners
    if (response.data.note) {
      apiNote.value = response.data.note
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      error.value = 'Too many searches. Please wait 30 seconds before trying again.'
      rateLimited.value = true
      setTimeout(() => { rateLimited.value = false }, 30_000)
    } else {
      error.value = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? 'Failed to fetch fuel prices')
        : 'Failed to fetch fuel prices'
    }
    stations.value = []
  } finally {
    loading.value = false
  }
}
</script>
