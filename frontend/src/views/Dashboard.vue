<template>
  <div class="min-h-screen bg-background">
    <div class="container mx-auto p-4 space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-3xl font-bold">
          {{
            selectedVehicle
              ? `${selectedVehicle.make || 'Unknown'} ${selectedVehicle.model || ''}`
              : 'Dashboard'
          }}
        </h1>
        <div v-if="vehiclesStore.vehicles.length > 0">
          <Button @click="$router.push('/vehicles/new')">Add Vehicle</Button>
        </div>
      </div>

      <div v-if="vehiclesStore.loading" class="text-center py-12">
        <p class="text-muted-foreground">Loading...</p>
      </div>

      <div
        v-else-if="vehiclesStore.vehicles.length === 0"
        class="text-center py-12"
      >
        <p class="text-muted-foreground mb-4">
          No vehicles yet. Add your first vehicle to get started!
        </p>
        <Button @click="$router.push('/vehicles/new')">Add Vehicle</Button>
      </div>

      <div v-else class="space-y-6">
        <!-- Vehicles List -->
        <div>
          <h2 class="text-xl font-semibold mb-4">Your Vehicles</h2>
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card
              v-for="vehicle in vehiclesStore.vehicles"
              :key="vehicle.id"
              class="p-4 cursor-pointer hover:shadow-md transition-shadow"
              @click="selectVehicle(vehicle.id)"
            >
              <h2 class="text-xl font-semibold">
                {{ vehicle.make || 'Unknown' }} {{ vehicle.model || '' }}
              </h2>
              <p class="text-sm text-muted-foreground">
                {{ vehicle.year || 'N/A' }}
              </p>
              <p v-if="vehicle.vrm" class="text-xs text-muted-foreground mt-1">
                {{ vehicle.vrm }}
              </p>
            </Card>
          </div>
        </div>

        <!-- Widgets -->
        <div
          v-if="selectedVehicle"
          class="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <!-- MPG Widget -->
          <Card v-if="fuelStats" class="p-4">
            <h3 class="text-sm font-medium text-muted-foreground mb-2">
              Rolling MPG
            </h3>
            <p class="text-3xl font-bold">
              {{
                fuelStats.rolling_mpg ? fuelStats.rolling_mpg.toFixed(1) : 'N/A'
              }}
            </p>
            <p
              v-if="fuelStats.l_per_100km"
              class="text-sm text-muted-foreground mt-1"
            >
              {{ fuelStats.l_per_100km.toFixed(2) }} L/100km
            </p>
          </Card>

          <!-- Cost Per Mile Widget -->
          <Card v-if="fuelStats" class="p-4">
            <h3 class="text-sm font-medium text-muted-foreground mb-2">
              Cost Per Mile
            </h3>
            <p class="text-3xl font-bold">
              {{
                fuelStats.cost_per_mile
                  ? `£${fuelStats.cost_per_mile.toFixed(3)}`
                  : 'N/A'
              }}
            </p>
            <p
              v-if="fuelStats.total_cost_gbp"
              class="text-sm text-muted-foreground mt-1"
            >
              Total: £{{ fuelStats.total_cost_gbp.toFixed(2) }}
            </p>
          </Card>

          <!-- Upcoming Reminders Widget -->
          <Card class="p-4">
            <h3 class="text-sm font-medium text-muted-foreground mb-2">
              Upcoming Reminders
            </h3>
            <div
              v-if="upcomingReminders.length === 0"
              class="text-sm text-muted-foreground"
            >
              No upcoming reminders
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="reminder in upcomingReminders.slice(0, 3)"
                :key="reminder.id"
                class="text-sm"
              >
                <p class="font-medium">
                  {{ getReminderTypeLabel(reminder.type) }}
                </p>
                <p class="text-muted-foreground">
                  {{ format(new Date(reminder.due_date), 'MMM d, yyyy') }}
                </p>
              </div>
              <Button
                v-if="upcomingReminders.length > 3"
                variant="ghost"
                size="sm"
                @click="
                  $router.push(`/vehicles/${selectedVehicleId}/reminders`)
                "
              >
                View All ({{ upcomingReminders.length }})
              </Button>
            </div>
          </Card>
        </div>

        <!-- Quick Actions -->
        <Card v-if="selectedVehicle" class="p-4">
          <h3 class="text-lg font-semibold mb-4">Quick Actions</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              variant="outline"
              @click="$router.push(`/vehicles/${selectedVehicleId}/fuel/new`)"
              class="h-auto py-3 flex flex-col items-center gap-1"
            >
              <span class="text-2xl">⛽</span>
              <span>Add Fuel</span>
            </Button>
            <Button
              variant="outline"
              @click="
                $router.push(`/vehicles/${selectedVehicleId}/health-scans/new`)
              "
              class="h-auto py-3 flex flex-col items-center gap-1"
            >
              <span class="text-2xl">📸</span>
              <span>Health Scan</span>
            </Button>
            <Button
              variant="outline"
              @click="$router.push(`/fuel-prices`)"
              class="h-auto py-3 flex flex-col items-center gap-1"
            >
              <span class="text-2xl">💰</span>
              <span>Fuel Prices</span>
            </Button>
            <Button
              variant="outline"
              @click="
                $router.push(`/vehicles/${selectedVehicleId}/resale-pack`)
              "
              class="h-auto py-3 flex flex-col items-center gap-1"
            >
              <span class="text-2xl">📋</span>
              <span>Resale Pack</span>
            </Button>
          </div>
        </Card>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import apiClient from '@/api/client';
import { format } from 'date-fns';
import { useVehiclesStore } from '@/stores/vehicles';
import type { FuelStats, Reminder, ReminderType } from '@carbobo/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const vehiclesStore = useVehiclesStore();

const selectedVehicleId = ref<string | null>(null);
const fuelStats = ref<FuelStats | null>(null);
const upcomingReminders = ref<Reminder[]>([]);

const selectedVehicle = computed(() => {
  if (!selectedVehicleId.value) return null;
  return vehiclesStore.vehicles.find(
    (v: { id: string }) => v.id === selectedVehicleId.value,
  );
});

function getReminderTypeLabel(type: ReminderType): string {
  const labels: Record<ReminderType, string> = {
    mot: 'MOT',
    service: 'Service',
    insurance: 'Insurance',
  };
  return labels[type];
}

function selectVehicle(vehicleId: string) {
  selectedVehicleId.value = vehicleId;
  loadVehicleData();
}

async function loadVehicleData() {
  if (!selectedVehicleId.value) return;

  try {
    // Load fuel stats
    const fuelResponse = await apiClient.get(
      `/vehicles/${selectedVehicleId.value}/fuel/stats`,
    );
    fuelStats.value = fuelResponse.data.stats || null;

    // Load upcoming reminders
    const remindersResponse = await apiClient.get(
      '/reminders/upcoming?limit=5',
    );
    const allReminders = remindersResponse.data.reminders || [];
    upcomingReminders.value = allReminders.filter(
      (r: Reminder) => r.vehicle_id === selectedVehicleId.value,
    );
  } catch (error) {
    console.error('Failed to load vehicle data:', error);
  }
}

onMounted(async () => {
  await vehiclesStore.fetchVehicles();
  const first = vehiclesStore.vehicles[0];
  if (first) {
    selectedVehicleId.value = first.id;
    await loadVehicleData();
  }
});
</script>
