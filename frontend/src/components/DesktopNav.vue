<template>
  <aside class="hidden md:block w-64 bg-card border-r border-border min-h-screen p-4">
    <h2 class="text-xl font-bold mb-4">Carbobo</h2>
    <nav class="space-y-2">
      <router-link
        to="/"
        class="block px-4 py-2 rounded hover:bg-accent"
        :class="{ 'bg-accent': $route.path === '/' }"
      >
        Dashboard
      </router-link>
      <router-link
        to="/vehicles/manage"
        class="block px-4 py-2 rounded hover:bg-accent"
        :class="{ 'bg-accent': $route.name === 'vehicles-manage' }"
      >
        Manage Vehicles
      </router-link>
      <router-link
        :to="fuelHistoryPath"
        class="block px-4 py-2 rounded hover:bg-accent"
        :class="{ 'bg-accent': $route.name === 'fuel-history' }"
      >
        Fuel History
      </router-link>
      <router-link
        to="/fuel-prices"
        class="block px-4 py-2 rounded hover:bg-accent"
        :class="{ 'bg-accent': $route.path === '/fuel-prices' }"
      >
        Fuel Prices
      </router-link>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useVehiclesStore } from '@/stores/vehicles';

const route = useRoute();
const vehiclesStore = useVehiclesStore();

const fuelHistoryPath = computed(() => {
  // Prefer vehicleId from the current route (e.g. already on a vehicle-scoped page)
  const routeVehicleId = route.params.vehicleId as string | undefined;
  if (routeVehicleId) {
    return `/vehicles/${routeVehicleId}/fuel`;
  }

  // Fall back to currentVehicle from the store if available
  if (vehiclesStore.currentVehicle?.id) {
    return `/vehicles/${vehiclesStore.currentVehicle.id}/fuel`;
  }

  // If we don't have a selected vehicle yet, send user home
  return '/';
});
</script>
