<template>
  <div class="container mx-auto p-4 max-w-2xl">
    <Card>
      <CardHeader>
        <CardTitle>{{ entryId ? 'Edit Fuel Entry' : 'Add Fuel Entry' }}</CardTitle>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-2">
            <Label for="occurred_at">Date</Label>
            <Input
              id="occurred_at"
              v-model="form.occurred_at"
              type="datetime-local"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="odometer_reading">Odometer Reading</Label>
            <Input
              id="odometer_reading"
              v-model.number="form.odometer_reading"
              type="number"
              step="0.1"
              :placeholder="vehicle?.odometer_unit_default === 'miles' ? 'Miles' : 'Kilometers'"
              required
            />
            <p class="text-xs text-muted-foreground">
              Unit: {{ vehicle?.odometer_unit_default === 'miles' ? 'Miles' : 'Kilometers' }}
            </p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="litres_added">Litres Added</Label>
              <Input
                id="litres_added"
                v-model.number="form.litres_added"
                type="number"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
            <div class="space-y-2">
              <Label for="fuel_type">Fuel Type</Label>
              <Select id="fuel_type" v-model="form.fuel_type">
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="electric">Electric</option>
                <option value="hybrid">Hybrid</option>
              </Select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="total_cost_gbp">Total Cost (£)</Label>
              <Input
                id="total_cost_gbp"
                v-model.number="form.total_cost_gbp"
                type="number"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
            <div class="space-y-2">
              <Label for="price_pence_per_litre">Price (pence/L)</Label>
              <Input
                id="price_pence_per_litre"
                v-model.number="form.price_pence_per_litre"
                type="number"
                step="0.1"
                placeholder="0.0"
                required
              />
            </div>
          </div>
          <div v-if="costWarning" class="text-sm text-destructive bg-destructive/10 p-2 rounded">
            {{ costWarning }}
          </div>
          <div class="space-y-2">
            <div class="flex items-center space-x-2">
              <Checkbox id="is_full_tank" v-model="form.is_full_tank" />
              <Label for="is_full_tank" class="cursor-pointer">Full Tank</Label>
            </div>
            <p class="text-xs text-muted-foreground">
              Uncheck if this is a partial fill-up
            </p>
          </div>
          <div class="space-y-2">
            <Label for="town_pct">Town Driving Percentage: {{ form.town_pct }}%</Label>
            <Slider
              id="town_pct"
              v-model="form.town_pct"
              :min="0"
              :max="100"
              :step="5"
            />
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>Motorway</span>
              <span>Town</span>
            </div>
          </div>
          <div class="space-y-2">
            <Label for="notes">Notes (Optional)</Label>
            <Input id="notes" v-model="form.notes" placeholder="Any additional notes..." />
          </div>
          <div v-if="error" class="text-sm text-destructive">{{ error }}</div>
          <div class="flex gap-2">
            <Button type="submit" :disabled="loading">
              {{ loading ? 'Saving...' : 'Save' }}
            </Button>
            <Button type="button" variant="outline" @click="$router.back()">Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import apiClient from '@/api/client'
import { useVehiclesStore } from '@/stores/vehicles'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import type { FuelEntry, FuelType } from '@carbobo/shared'
import { format } from 'date-fns'

const route = useRoute()
const router = useRouter()
const vehiclesStore = useVehiclesStore()

const vehicleId = route.params.vehicleId as string
const entryId = route.params.entryId as string | undefined
const loading = ref(false)
const error = ref('')
const vehicle = ref<any>(null)

const form = ref<{
  occurred_at: string
  odometer_reading: number | null
  litres_added: number | null
  is_full_tank: boolean
  total_cost_gbp: number | null
  price_pence_per_litre: number | null
  fuel_type: FuelType
  town_pct: number
  notes?: string
}>({
  occurred_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  odometer_reading: null,
  litres_added: null,
  is_full_tank: true,
  total_cost_gbp: null,
  price_pence_per_litre: null,
  fuel_type: 'petrol',
  town_pct: 50,
  notes: '',
})

const costWarning = computed(() => {
  if (
    form.value.total_cost_gbp &&
    form.value.price_pence_per_litre &&
    form.value.litres_added
  ) {
    const expectedCost = (form.value.price_pence_per_litre * form.value.litres_added) / 100
    const tolerance = 0.5
    if (Math.abs(form.value.total_cost_gbp - expectedCost) > tolerance) {
      return `Cost (£${form.value.total_cost_gbp.toFixed(2)}) doesn't match price (£${expectedCost.toFixed(2)}). Please verify.`
    }
  }
  return null
})

onMounted(async () => {
  // Fetch vehicle
  const vehicleResult = await vehiclesStore.fetchVehicle(vehicleId)
  if (vehicleResult.success && vehicleResult.vehicle) {
    vehicle.value = vehicleResult.vehicle
    form.value.fuel_type = vehicleResult.vehicle.fuel_type_default
  }

  // If editing, fetch entry
  if (entryId) {
    try {
      const response = await apiClient.get(`/vehicles/${vehicleId}/fuel`)
      const entry = response.data.entries.find((e: FuelEntry) => e.id === entryId)
      if (entry) {
        form.value = {
          occurred_at: format(new Date(entry.occurred_at), "yyyy-MM-dd'T'HH:mm"),
          odometer_reading: entry.odometer_reading,
          litres_added: entry.litres_added,
          is_full_tank: entry.is_full_tank,
          total_cost_gbp: entry.total_cost_gbp,
          price_pence_per_litre: entry.price_pence_per_litre,
          fuel_type: entry.fuel_type,
          town_pct: entry.town_pct,
          notes: entry.notes || '',
        }
      }
    } catch (err) {
      console.error('Failed to fetch fuel entry:', err)
    }
  }
})

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    const payload = {
      ...form.value,
      occurred_at: new Date(form.value.occurred_at).toISOString(),
    }

    const url = entryId
      ? `/vehicles/${vehicleId}/fuel/${entryId}`
      : `/vehicles/${vehicleId}/fuel`

    const method = entryId ? 'put' : 'post'

    const response = await apiClient[method](url, payload)

    if (response.data.warning) {
      // Show warning but still proceed
      error.value = response.data.warning
      setTimeout(() => {
        router.push(`/vehicles/${vehicleId}/fuel`)
      }, 2000)
    } else {
      router.push(`/vehicles/${vehicleId}/fuel`)
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to save fuel entry'
  } finally {
    loading.value = false
  }
}
</script>
