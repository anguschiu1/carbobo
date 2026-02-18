<template>
  <div class="container mx-auto p-4 max-w-2xl">
    <Card>
      <CardHeader>
        <CardTitle>{{ vehicleId ? 'Edit Vehicle' : 'Add Vehicle' }}</CardTitle>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="make">Make</Label>
              <Input id="make" v-model="form.make" placeholder="e.g., Ford" />
            </div>
            <div class="space-y-2">
              <Label for="model">Model</Label>
              <Input id="model" v-model="form.model" placeholder="e.g., Focus" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="year">Year</Label>
              <Input
                id="year"
                v-model.number="form.year"
                type="number"
                :min="1900"
                :max="new Date().getFullYear() + 1"
                placeholder="2020"
              />
            </div>
            <div class="space-y-2">
              <Label for="vrm">VRM (Optional)</Label>
              <Input id="vrm" v-model="form.vrm" placeholder="AB12 CDE" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="fuel_type_default">Default Fuel Type</Label>
              <Select id="fuel_type_default" v-model="form.fuel_type_default">
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="electric">Electric</option>
                <option value="hybrid">Hybrid</option>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="odometer_unit_default">Odometer Unit</Label>
              <Select id="odometer_unit_default" v-model="form.odometer_unit_default">
                <option value="miles">Miles</option>
                <option value="km">Kilometers</option>
              </Select>
            </div>
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
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVehiclesStore } from '@/stores/vehicles'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { FuelType, OdometerUnit } from '@carbobo/shared'

const route = useRoute()
const router = useRouter()
const vehiclesStore = useVehiclesStore()

const vehicleId = route.params.id as string | undefined
const loading = ref(false)
const error = ref('')

const form = ref<{
  make?: string
  model?: string
  year?: number
  vrm?: string
  fuel_type_default: FuelType
  odometer_unit_default: OdometerUnit
}>({
  fuel_type_default: 'petrol',
  odometer_unit_default: 'miles',
})

onMounted(async () => {
  if (vehicleId) {
    const result = await vehiclesStore.fetchVehicle(vehicleId)
    if (result.success && result.vehicle) {
      form.value = {
        make: result.vehicle.make,
        model: result.vehicle.model,
        year: result.vehicle.year,
        vrm: result.vehicle.vrm,
        fuel_type_default: result.vehicle.fuel_type_default,
        odometer_unit_default: result.vehicle.odometer_unit_default,
      }
    }
  }
})

async function handleSubmit() {
  error.value = ''
  loading.value = true

  const result = vehicleId
    ? await vehiclesStore.updateVehicle(vehicleId, form.value)
    : await vehiclesStore.createVehicle(form.value)

  if (result.success) {
    router.push('/')
  } else {
    error.value = result.error || 'Failed to save vehicle'
  }

  loading.value = false
}
</script>
