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
</script>
