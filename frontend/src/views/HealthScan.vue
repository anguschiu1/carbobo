<template>
  <div class="container mx-auto p-4 max-w-2xl">
    <Card>
      <CardHeader>
        <CardTitle>Monthly Health Scan</CardTitle>
        <p class="text-sm text-muted-foreground">Step {{ currentStep }} of {{ totalSteps }}</p>
      </CardHeader>
      <CardContent>
        <!-- Step 1: Tyre Photo -->
        <div v-if="currentStep === 1" class="space-y-4">
          <h3 class="text-lg font-semibold">Step 1: Tyre Photo</h3>
          <p class="text-sm text-muted-foreground">
            Take a photo of your tyres showing tread depth and condition
          </p>
          <div class="space-y-2">
            <Label for="tyre_photo">Tyre Photo</Label>
            <Input
              id="tyre_photo"
              type="file"
              accept="image/*"
              capture="environment"
              @change="handlePhotoChange($event, 'tyre')"
            />
            <img
              v-if="photos.tyre"
              :src="photos.tyre"
              alt="Tyre preview"
              class="w-full max-w-md mx-auto rounded-lg border"
            />
          </div>
        </div>

        <!-- Step 2: Exterior Photo -->
        <div v-if="currentStep === 2" class="space-y-4">
          <h3 class="text-lg font-semibold">Step 2: Exterior Photo</h3>
          <p class="text-sm text-muted-foreground">
            Take a photo of the exterior showing any visible damage or wear
          </p>
          <div class="space-y-2">
            <Label for="exterior_photo">Exterior Photo</Label>
            <Input
              id="exterior_photo"
              type="file"
              accept="image/*"
              capture="environment"
              @change="handlePhotoChange($event, 'exterior')"
            />
            <img
              v-if="photos.exterior"
              :src="photos.exterior"
              alt="Exterior preview"
              class="w-full max-w-md mx-auto rounded-lg border"
            />
          </div>
        </div>

        <!-- Step 3: Dashboard Photo -->
        <div v-if="currentStep === 3" class="space-y-4">
          <h3 class="text-lg font-semibold">Step 3: Dashboard/Odometer Photo</h3>
          <p class="text-sm text-muted-foreground">
            Take a photo of your dashboard showing the odometer reading
          </p>
          <div class="space-y-2">
            <Label for="dashboard_photo">Dashboard Photo</Label>
            <Input
              id="dashboard_photo"
              type="file"
              accept="image/*"
              capture="environment"
              @change="handlePhotoChange($event, 'dashboard')"
            />
            <img
              v-if="photos.dashboard"
              :src="photos.dashboard"
              alt="Dashboard preview"
              class="w-full max-w-md mx-auto rounded-lg border"
            />
          </div>
        </div>

        <!-- Step 4: Odometer Reading -->
        <div v-if="currentStep === 4" class="space-y-4">
          <h3 class="text-lg font-semibold">Step 4: Odometer Reading</h3>
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
        </div>

        <!-- Step 5: Questions -->
        <div v-if="currentStep === 5" class="space-y-4">
          <h3 class="text-lg font-semibold">Step 5: Quick Check</h3>
          <div class="space-y-4">
            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <Checkbox id="warning_lights" v-model="form.warning_lights" />
                <Label for="warning_lights" class="cursor-pointer">
                  Are there any warning lights on the dashboard?
                </Label>
              </div>
            </div>
            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <Checkbox id="new_noises" v-model="form.new_noises" />
                <Label for="new_noises" class="cursor-pointer">
                  Have you noticed any new or unusual noises?
                </Label>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 6: Advice -->
        <div v-if="currentStep === 6" class="space-y-4">
          <h3 class="text-lg font-semibold">Health Scan Complete!</h3>
          <div v-if="scanResult" class="space-y-4">
            <div class="p-4 bg-muted rounded-lg whitespace-pre-line">
              {{ scanResult.generated_advice }}
            </div>
            <div class="text-sm text-muted-foreground">
              Scan completed on {{ format(new Date(scanResult.scan_at), 'MMM d, yyyy HH:mm') }}
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="flex justify-between mt-6">
          <Button
            v-if="currentStep > 1 && currentStep < 6"
            variant="outline"
            @click="currentStep--"
          >
            Previous
          </Button>
          <div v-else></div>
          <div class="flex gap-2">
            <Button
              v-if="currentStep < 5"
              @click="handleNext"
              :disabled="!canProceed"
            >
              Next
            </Button>
            <Button
              v-if="currentStep === 5"
              @click="handleSubmit"
              :disabled="loading"
            >
              {{ loading ? 'Submitting...' : 'Complete Scan' }}
            </Button>
            <Button
              v-if="currentStep === 6"
              @click="$router.push(`/vehicles/${vehicleId}/health-scans`)"
            >
              View All Scans
            </Button>
          </div>
        </div>

        <div v-if="error" class="text-sm text-destructive mt-4">{{ error }}</div>
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
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import type { HealthScan } from '@carbobo/shared'

const route = useRoute()
const router = useRouter()
const vehiclesStore = useVehiclesStore()

const vehicleId = route.params.vehicleId as string
const currentStep = ref(1)
const totalSteps = 6
const loading = ref(false)
const error = ref('')
const vehicle = ref<any>(null)
const scanResult = ref<HealthScan | null>(null)

const photos = ref<{
  tyre: string | null
  exterior: string | null
  dashboard: string | null
}>({
  tyre: null,
  exterior: null,
  dashboard: null,
})

const photoFiles = ref<{
  tyre: File | null
  exterior: File | null
  dashboard: File | null
}>({
  tyre: null,
  exterior: null,
  dashboard: null,
})

const form = ref<{
  odometer_reading: number | null
  warning_lights: boolean
  new_noises: boolean
}>({
  odometer_reading: null,
  warning_lights: false,
  new_noises: false,
})

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 1:
      return !!photos.value.tyre
    case 2:
      return !!photos.value.exterior
    case 3:
      return !!photos.value.dashboard
    case 4:
      return form.value.odometer_reading !== null && form.value.odometer_reading >= 0
    case 5:
      return true
    default:
      return true
  }
})

onMounted(async () => {
  const vehicleResult = await vehiclesStore.fetchVehicle(vehicleId)
  if (vehicleResult.success && vehicleResult.vehicle) {
    vehicle.value = vehicleResult.vehicle
  }
})

function handlePhotoChange(event: Event, type: 'tyre' | 'exterior' | 'dashboard') {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    photoFiles.value[type] = file
    const reader = new FileReader()
    reader.onload = (e) => {
      photos.value[type] = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

function handleNext() {
  if (canProceed.value) {
    currentStep.value++
  }
}

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    const formData = new FormData()
    
    if (photoFiles.value.tyre) {
      formData.append('tyre_photo', photoFiles.value.tyre)
    }
    if (photoFiles.value.exterior) {
      formData.append('exterior_photo', photoFiles.value.exterior)
    }
    if (photoFiles.value.dashboard) {
      formData.append('dashboard_photo', photoFiles.value.dashboard)
    }

    formData.append('scan_at', new Date().toISOString())
    formData.append('odometer_reading', form.value.odometer_reading!.toString())
    formData.append('odometer_unit', vehicle.value.odometer_unit_default)
    formData.append('warning_lights', form.value.warning_lights.toString())
    formData.append('new_noises', form.value.new_noises.toString())

    const response = await apiClient.post(
      `/vehicles/${vehicleId}/health-scans`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )

    scanResult.value = response.data.scan
    currentStep.value = 6
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to submit health scan'
  } finally {
    loading.value = false
  }
}
</script>
