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
            <Input
              id="postcode"
              v-model="searchForm.postcode"
              placeholder="e.g., SW1A 1AA"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="fuel_type">Fuel Type</Label>
            <Select id="fuel_type" v-model="searchForm.fuel_type">
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="radius">Radius (km)</Label>
            <Input
              id="radius"
              v-model.number="searchForm.radius_km"
              type="number"
              :min="1"
              :max="50"
              required
            />
          </div>
        </div>
        <Button type="submit" :disabled="loading" class="w-full md:w-auto">
          {{ loading ? 'Searching...' : 'Search' }}
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
              <p v-if="station.distance_km" class="text-xs text-muted-foreground mt-1">
                {{ station.distance_km.toFixed(1) }} km away
              </p>
            </div>

            <div class="text-right shrink-0">
              <p class="text-2xl font-bold leading-none">
                {{ station.price_pence_per_litre.toFixed(1) }}p/L
              </p>
              <!-- Per-tank estimate (50 L) -->
              <p class="text-xs text-muted-foreground mt-1">
                ~£{{ perTankCost(station.price_pence_per_litre) }} per tank
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
                Updated: {{ format(new Date(station.last_updated), 'MMM d, HH:mm') }}
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
import { ref, onMounted } from 'vue'
import { format, differenceInHours } from 'date-fns'
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
  distance_km?: number
}

const vehicleStore = useVehiclesStore()

const loading = ref(false)
// Hard errors only (network failures, 4xx/5xx responses)
const error = ref('')
// Informational API notes (e.g. "data temporarily unavailable")
const apiNote = ref('')
const searched = ref(false)
const stations = ref<FuelStation[]>([])
const lastSearchPostcode = ref('')

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
 * Calculates an estimated cost for a 50 L full tank fill at the given price.
 * Returns a string formatted to 2 decimal places (e.g. "72.95").
 */
function perTankCost(pricePencePerLitre: number): string {
  return ((pricePencePerLitre * 50) / 100).toFixed(2)
}

/**
 * Returns true when a price's last_updated timestamp is more than 2 hours ago,
 * indicating the data may be stale and should be flagged to the user.
 */
function isPriceStale(lastUpdated: string): boolean {
  return differenceInHours(new Date(), new Date(lastUpdated)) > 2
}

onMounted(() => {
  const vehicle = vehicleStore.currentVehicle
  if (vehicle) {
    const mapped = mapVehicleFuelType(vehicle.fuel_type_default)
    if (mapped !== null) {
      searchForm.value.fuel_type = mapped
    }
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

    // Treat notes as informational, not errors — displayed as amber banners
    if (response.data.note) {
      apiNote.value = response.data.note
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to fetch fuel prices'
    stations.value = []
  } finally {
    loading.value = false
  }
}
</script>
