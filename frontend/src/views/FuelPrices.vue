<template>
  <div class="container mx-auto p-4 space-y-6">
    <h1 class="text-3xl font-bold">Nearby Fuel Prices</h1>

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

    <div v-if="error" class="text-sm text-destructive bg-destructive/10 p-4 rounded">
      {{ error }}
    </div>

    <div v-if="stations.length > 0" class="space-y-4">
      <div class="text-sm text-muted-foreground">
        Found {{ stations.length }} stations near {{ lastSearchPostcode }}
      </div>
      <div class="space-y-2">
        <Card
          v-for="station in stations"
          :key="station.id"
          class="p-4 hover:shadow-md transition-shadow"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <h3 class="font-semibold text-lg">{{ station.name }}</h3>
              <p class="text-sm text-muted-foreground">{{ station.brand }}</p>
              <p class="text-sm">{{ station.address }}</p>
              <p class="text-sm text-muted-foreground">{{ station.postcode }}</p>
              <p v-if="station.distance_km" class="text-xs text-muted-foreground mt-1">
                {{ station.distance_km.toFixed(1) }} km away
              </p>
            </div>
            <div class="text-right">
              <p class="text-2xl font-bold">
                {{ (station.price_pence_per_litre / 100).toFixed(1) }}p/L
              </p>
              <p class="text-xs text-muted-foreground">
                Updated: {{ format(new Date(station.last_updated), 'MMM d, HH:mm') }}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>

    <div v-else-if="searched && !loading" class="text-center py-12 text-muted-foreground">
      No stations found. Try a different postcode or increase the radius.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import apiClient from '@/api/client'
import { format } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

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

const loading = ref(false)
const error = ref('')
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

async function handleSearch() {
  error.value = ''
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

    if (response.data.note) {
      error.value = response.data.note
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to fetch fuel prices'
    stations.value = []
  } finally {
    loading.value = false
  }
}
</script>
