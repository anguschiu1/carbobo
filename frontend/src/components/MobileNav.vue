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
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = computed(() => {
  const vehicleId = route.params.vehicleId as string | undefined

  return [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: vehicleId ? `/vehicles/${vehicleId}/fuel` : '/', label: 'Fuel', icon: '⛽' },
    { path: vehicleId ? `/vehicles/${vehicleId}/health-scans` : '/', label: 'Scan', icon: '📸' },
    { path: vehicleId ? `/vehicles/${vehicleId}/documents` : '/', label: 'Docs', icon: '📄' },
  ]
})
</script>
