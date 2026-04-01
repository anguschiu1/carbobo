<template>
  <div class="container mx-auto p-4 space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">
        {{ vehicle?.make }} {{ vehicle?.model }} - Fuel History
      </h1>
      <Button @click="$router.push(`/vehicles/${vehicleId}/fuel/new`)">
        Add Entry
      </Button>
    </div>

    <!-- Stats -->
    <Card v-if="stats" class="p-6">
      <h2 class="text-xl font-semibold mb-4">Statistics</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p class="text-sm text-muted-foreground">Rolling MPG</p>
          <p class="text-2xl font-bold">
            {{ stats.rolling_mpg ? stats.rolling_mpg.toFixed(1) : 'N/A' }}
          </p>
        </div>
        <div>
          <p class="text-sm text-muted-foreground">L/100km</p>
          <p class="text-2xl font-bold">
            {{ stats.l_per_100km ? stats.l_per_100km.toFixed(2) : 'N/A' }}
          </p>
        </div>
        <div>
          <p class="text-sm text-muted-foreground">Cost/Mile</p>
          <p class="text-2xl font-bold">
            {{
              stats.cost_per_mile ? `£${stats.cost_per_mile.toFixed(3)}` : 'N/A'
            }}
          </p>
        </div>
        <div>
          <p class="text-sm text-muted-foreground">Total Distance</p>
          <p class="text-2xl font-bold">
            <span v-if="vehicle?.odometer_unit_default === 'km'">
              {{
                stats.total_distance_km
                  ? `${stats.total_distance_km.toFixed(2)} km`
                  : 'N/A'
              }}
            </span>
            <span v-else>
              {{
                stats.total_distance_miles
                  ? `${stats.total_distance_miles.toFixed(2)} mi`
                  : 'N/A'
              }}
            </span>
          </p>
        </div>
      </div>
    </Card>

    <!-- Intervals -->
    <div v-if="intervals.length > 0" class="space-y-4">
      <h2 class="text-xl font-semibold">
        Fuel Intervals (Full Tank to Full Tank)
      </h2>
      <Card v-for="(interval, idx) in intervals" :key="idx" class="p-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p class="text-muted-foreground">Distance</p>
            <p class="font-semibold">
              <span v-if="vehicle?.odometer_unit_default === 'km'">
                {{ interval.distance_km.toFixed(1) }} km
              </span>
              <span v-else>
                {{ interval.distance_miles.toFixed(1) }} mi
              </span>
            </p>
          </div>
          <div>
            <p class="text-muted-foreground">Litres</p>
            <p class="font-semibold">
              {{ interval.litres_total.toFixed(2) }} L
            </p>
          </div>
          <div>
            <p class="text-muted-foreground">MPG</p>
            <p class="font-semibold">{{ interval.mpg.toFixed(1) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Cost/Mile</p>
            <p class="font-semibold">
              £{{ interval.cost_per_mile.toFixed(3) }}
            </p>
          </div>
        </div>
        <p class="text-xs text-muted-foreground mt-2">
          {{
            format(new Date(interval.start_entry.occurred_at), 'MMM d, yyyy')
          }}
          -
          {{ format(new Date(interval.end_entry.occurred_at), 'MMM d, yyyy') }}
        </p>
      </Card>
    </div>

    <!-- Entries -->
    <div class="space-y-4">
      <h2 class="text-xl font-semibold">All Entries</h2>
      <Card v-for="entry in entries" :key="entry.id" class="p-4">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-semibold">
              {{ format(new Date(entry.occurred_at), 'MMM d, yyyy HH:mm') }}
            </p>
            <p class="text-sm text-muted-foreground">
              {{ entry.odometer_reading.toFixed(1) }}
              {{ entry.odometer_unit === 'miles' ? 'mi' : 'km' }}
            </p>
            <p class="text-sm">
              {{ entry.litres_added }}L @
              {{ entry.price_pence_per_litre / 100 }}p/L = £{{
                entry.total_cost_gbp.toFixed(2)
              }}
            </p>
            <p v-if="entry.is_full_tank" class="text-xs text-primary mt-1">
              Full Tank
            </p>
            <p v-else class="text-xs text-muted-foreground mt-1">
              Partial Fill
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            @click="
              $router.push(`/vehicles/${vehicleId}/fuel/${entry.id}/edit`)
            "
          >
            Edit
          </Button>
        </div>
      </Card>
      <div
        v-if="entries.length === 0"
        class="text-center py-12 text-muted-foreground"
      >
        No fuel entries yet. Add your first entry to start tracking!
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import apiClient from '@/api/client';
import { format } from 'date-fns';
import type { FuelEntry, FuelStats, FuelInterval } from '@carbobo/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useVehiclesStore } from '@/stores/vehicles';

const route = useRoute();
const vehicleId = route.params.vehicleId as string;

const vehiclesStore = useVehiclesStore();
const vehicle = computed(
  () =>
    vehiclesStore.vehicles.find((v) => v.id === vehicleId) ||
    vehiclesStore.currentVehicle,
);

const entries = ref<FuelEntry[]>([]);
const stats = ref<FuelStats | null>(null);
const intervals = ref<FuelInterval[]>([]);

onMounted(async () => {
  try {
    // Ensure vehicle details are loaded for header
    if (!vehicle.value) {
      await vehiclesStore.fetchVehicle(vehicleId);
    }

    // Fetch entries
    const entriesResponse = await apiClient.get(`/vehicles/${vehicleId}/fuel`);
    entries.value = entriesResponse.data.entries || [];

    // Fetch stats
    const statsResponse = await apiClient.get(
      `/vehicles/${vehicleId}/fuel/stats`,
    );
    stats.value = statsResponse.data.stats || null;
    intervals.value = statsResponse.data.intervals || [];
  } catch (error) {
    console.error('Failed to fetch fuel data:', error);
  }
});
</script>
