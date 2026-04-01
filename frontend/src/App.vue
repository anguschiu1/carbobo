<template>
  <div class="min-h-screen pb-16 md:pb-0 flex">
    <DesktopNav />
    <div class="flex-1 flex flex-col">
      <!-- Mobile top bar with burger -->
      <header
        class="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background sticky top-0 z-40"
      >
        <h1 class="text-lg font-semibold">Carbobo</h1>
        <div class="relative">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
            @click="isMobileMenuOpen = !isMobileMenuOpen"
          >
            <span class="sr-only">Open main menu</span>
            <!-- Simple burger icon -->
            <span class="flex flex-col justify-center gap-1.5">
              <span class="block w-5 h-0.5 rounded-full bg-foreground"></span>
              <span class="block w-5 h-0.5 rounded-full bg-foreground"></span>
              <span class="block w-5 h-0.5 rounded-full bg-foreground"></span>
            </span>
          </button>
          <div
            v-if="isMobileMenuOpen"
            class="absolute right-0 mt-2 w-40 rounded-md border border-border bg-popover shadow-lg py-1 text-sm"
          >
            <router-link
              to="/"
              class="block px-3 py-2 hover:bg-accent"
              @click="isMobileMenuOpen = false"
            >
              Dashboard
            </router-link>
            <router-link
              :to="fuelHistoryPath"
              class="block px-3 py-2 hover:bg-accent"
              @click="isMobileMenuOpen = false"
            >
              Fuel History
            </router-link>
            <router-link
              to="/fuel-prices"
              class="block px-3 py-2 hover:bg-accent"
              @click="isMobileMenuOpen = false"
            >
              Fuel Prices
            </router-link>
          </div>
        </div>
      </header>

      <main class="flex-1">
        <RouterView />
      </main>
    </div>
    <MobileNav />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import MobileNav from '@/components/MobileNav.vue';
import DesktopNav from '@/components/DesktopNav.vue';
import { useVehiclesStore } from '@/stores/vehicles';

const isMobileMenuOpen = ref(false);

const route = useRoute();
const vehiclesStore = useVehiclesStore();

const fuelHistoryPath = computed(() => {
  const routeVehicleId = route.params.vehicleId as string | undefined;
  if (routeVehicleId) {
    return `/vehicles/${routeVehicleId}/fuel`;
  }
  if (vehiclesStore.currentVehicle?.id) {
    return `/vehicles/${vehiclesStore.currentVehicle.id}/fuel`;
  }
  const first = vehiclesStore.vehicles[0];
  return first?.id ? `/vehicles/${first.id}/fuel` : '/';
});
</script>
