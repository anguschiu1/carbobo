<template>
  <div class="container mx-auto p-4 space-y-6">
    <div v-if="loading" class="text-center py-12">Loading...</div>
    <div v-else-if="error" class="text-center py-12 text-destructive">{{ error }}</div>
    <div v-else-if="data" class="space-y-6">
      <!-- Vehicle Info -->
      <Card class="p-6">
        <h1 class="text-3xl font-bold mb-2">
          {{ data.vehicle.make || 'Vehicle' }} {{ data.vehicle.model || '' }}
        </h1>
        <p class="text-muted-foreground">
          {{ data.vehicle.year || 'N/A' }}
          <span v-if="data.vehicle.vrm"> • {{ data.vehicle.vrm }}</span>
        </p>
      </Card>

      <!-- Summary -->
      <Card class="p-6">
        <h2 class="text-xl font-semibold mb-4">Summary</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p class="text-sm text-muted-foreground">Health Scans</p>
            <p class="text-2xl font-bold">{{ data.summary.total_health_scans }}</p>
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Documents</p>
            <p class="text-2xl font-bold">{{ data.summary.total_documents }}</p>
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Fuel Entries</p>
            <p class="text-2xl font-bold">{{ data.summary.total_fuel_entries }}</p>
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Reminders</p>
            <p class="text-2xl font-bold">{{ data.summary.total_reminders }}</p>
          </div>
        </div>
      </Card>

      <!-- Fuel Stats -->
      <Card v-if="data.fuel_stats" class="p-6">
        <h2 class="text-xl font-semibold mb-4">Fuel Statistics</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p class="text-sm text-muted-foreground">Rolling MPG</p>
            <p class="text-2xl font-bold">
              {{ data.fuel_stats.rolling_mpg ? data.fuel_stats.rolling_mpg.toFixed(1) : 'N/A' }}
            </p>
          </div>
          <div>
            <p class="text-sm text-muted-foreground">L/100km</p>
            <p class="text-2xl font-bold">
              {{ data.fuel_stats.l_per_100km ? data.fuel_stats.l_per_100km.toFixed(2) : 'N/A' }}
            </p>
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Cost/Mile</p>
            <p class="text-2xl font-bold">
              {{ data.fuel_stats.cost_per_mile ? `£${data.fuel_stats.cost_per_mile.toFixed(3)}` : 'N/A' }}
            </p>
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Total Distance</p>
            <p class="text-2xl font-bold">
              {{ data.fuel_stats.total_distance_miles ? `${data.fuel_stats.total_distance_miles.toFixed(0)} mi` : 'N/A' }}
            </p>
          </div>
        </div>
      </Card>

      <!-- Timeline -->
      <Card class="p-6">
        <h2 class="text-xl font-semibold mb-4">Timeline</h2>
        <div class="space-y-4">
          <div
            v-for="(item, idx) in data.timeline"
            :key="idx"
            class="border-l-2 border-primary pl-4 pb-4"
          >
            <div class="flex items-start gap-4">
              <div class="w-2 h-2 rounded-full bg-primary mt-2 -ml-6"></div>
              <div class="flex-1">
                <p class="text-sm text-muted-foreground">
                  {{ format(new Date(item.date), 'MMM d, yyyy') }}
                </p>
                <div v-if="item.type === 'health_scan'" class="mt-2">
                  <p class="font-semibold">Health Scan</p>
                  <p class="text-sm">
                    Odometer: {{ item.data.odometer_reading }} {{ item.data.odometer_unit === 'miles' ? 'mi' : 'km' }}
                  </p>
                  <p v-if="item.data.warning_lights" class="text-sm text-destructive">⚠️ Warning lights</p>
                  <p v-if="item.data.new_noises" class="text-sm text-destructive">🔊 New noises</p>
                </div>
                <div v-else-if="item.type === 'document'" class="mt-2">
                  <p class="font-semibold">{{ getDocumentTypeLabel(item.data.type) }}</p>
                  <p v-if="item.data.notes" class="text-sm">{{ item.data.notes }}</p>
                </div>
                <div v-else-if="item.type === 'fuel_entry'" class="mt-2">
                  <p class="font-semibold">Fuel Entry</p>
                  <p class="text-sm">
                    {{ item.data.litres_added }}L @ {{ (item.data.price_pence_per_litre / 100).toFixed(1) }}p/L
                    = £{{ item.data.total_cost_gbp.toFixed(2) }}
                  </p>
                </div>
                <div v-else-if="item.type === 'reminder'" class="mt-2">
                  <p class="font-semibold">{{ getReminderTypeLabel(item.data.type) }}</p>
                  <p v-if="item.data.notes" class="text-sm">{{ item.data.notes }}</p>
                </div>
              </div>
            </div>
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
import type { DocumentType, ReminderType } from '@carbobo/shared'
import { Card } from '@/components/ui/card'

const route = useRoute()
const shareId = route.params.shareId as string

const loading = ref(true)
const error = ref('')
const data = ref<any>(null)

function getDocumentTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    service_invoice: 'Service Invoice',
    mot_certificate: 'MOT Certificate',
    repair_receipt: 'Repair Receipt',
    other: 'Other Document',
  }
  return labels[type]
}

function getReminderTypeLabel(type: ReminderType): string {
  const labels: Record<ReminderType, string> = {
    mot: 'MOT Reminder',
    service: 'Service Reminder',
    insurance: 'Insurance Reminder',
  }
  return labels[type]
}

onMounted(async () => {
  try {
    const response = await apiClient.get(`/resale-pack/${shareId}`)
    data.value = response.data
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to load resale pack'
  } finally {
    loading.value = false
  }
})
</script>
