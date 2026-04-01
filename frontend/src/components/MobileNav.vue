<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-background border-t border-border md:hidden z-50">
    <div class="flex justify-around items-center h-16">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex flex-col items-center justify-center flex-1 h-full"
        :class="{ 'text-primary': $route.path === item.path }"
      >
        <span class="text-2xl">{{ item.icon }}</span>
        <span class="text-xs mt-1">{{ item.label }}</span>
      </router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useVehiclesStore } from '@/stores/vehicles';

const route = useRoute();
const vehiclesStore = useVehiclesStore();

const activeVehicleId = computed(() => {
  // Prefer vehicleId from the current route (already on a vehicle page)
  const routeVehicleId = route.params.vehicleId as string | undefined;
  if (routeVehicleId) {
    return routeVehicleId;
  }

  // Then fall back to the store's currentVehicle
  if (vehiclesStore.currentVehicle?.id) {
    return vehiclesStore.currentVehicle.id;
  }

  // Finally, try the first known vehicle (if any)
  const first = vehiclesStore.vehicles[0];
  return first?.id;
});

const navItems = computed(() => {
  const vehicleId = activeVehicleId.value;

  return [
    { path: '/', label: 'Home', icon: '🏠' },
    {
      path: vehicleId ? `/vehicles/${vehicleId}/fuel` : '/',
      label: 'Fuel',
      icon: '⛽',
    },
    {
      path: vehicleId ? `/vehicles/${vehicleId}/health-scans` : '/',
      label: 'Scan',
      icon: '📸',
    },
    {
      path: vehicleId ? `/vehicles/${vehicleId}/documents` : '/',
      label: 'Docs',
      icon: '📄',
    },
  ];
});
</script>
