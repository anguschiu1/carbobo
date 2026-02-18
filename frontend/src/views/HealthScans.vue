<template>
  <div class="container mx-auto p-4 space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Health Scans</h1>
      <Button @click="$router.push(`/vehicles/${vehicleId}/health-scans/new`)">
        New Scan
      </Button>
    </div>

    <div v-if="scans.length === 0" class="text-center py-12 text-muted-foreground">
      No health scans yet. Start your first monthly scan!
    </div>

    <div v-else class="space-y-4">
      <Card v-for="scan in scans" :key="scan.id" class="p-4">
        <div class="space-y-4">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="text-lg font-semibold">
                {{ format(new Date(scan.scan_at), 'MMM d, yyyy') }}
              </h3>
              <p class="text-sm text-muted-foreground">
                Odometer: {{ scan.odometer_reading }} {{ scan.odometer_unit === 'miles' ? 'mi' : 'km' }}
              </p>
            </div>
          </div>

          <div v-if="scan.warning_lights || scan.new_noises" class="space-y-2">
            <p v-if="scan.warning_lights" class="text-sm text-destructive">
              ⚠️ Warning lights detected
            </p>
            <p v-if="scan.new_noises" class="text-sm text-destructive">
              🔊 New noises reported
            </p>
          </div>

          <div v-if="scan.generated_advice" class="p-3 bg-muted rounded-lg whitespace-pre-line text-sm">
            {{ scan.generated_advice }}
          </div>

          <div v-if="scan.tyre_photo_url || scan.exterior_photo_url || scan.dashboard_photo_url" class="grid grid-cols-3 gap-2">
            <img
              v-if="scan.tyre_photo_url"
              :src="getImageUrl(scan.tyre_photo_url)"
              alt="Tyre photo"
              class="w-full h-24 object-cover rounded border"
            />
            <img
              v-if="scan.exterior_photo_url"
              :src="getImageUrl(scan.exterior_photo_url)"
              alt="Exterior photo"
              class="w-full h-24 object-cover rounded border"
            />
            <img
              v-if="scan.dashboard_photo_url"
              :src="getImageUrl(scan.dashboard_photo_url)"
              alt="Dashboard photo"
              class="w-full h-24 object-cover rounded border"
            />
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import apiClient from '@/api/client'
import { format } from 'date-fns'
import type { HealthScan } from '@carbobo/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const route = useRoute()
const vehicleId = route.params.vehicleId as string

const scans = ref<HealthScan[]>([])

function getImageUrl(url: string): string {
  if (url.startsWith('http')) return url
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${apiUrl}${url}`
}

onMounted(async () => {
  try {
    const response = await apiClient.get(`/vehicles/${vehicleId}/health-scans`)
    scans.value = response.data.scans || []
  } catch (error) {
    console.error('Failed to fetch health scans:', error)
  }
})
</script>
