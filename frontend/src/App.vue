<template>
  <div class="min-h-screen pb-16 md:pb-0 flex">
    <DesktopNav />
    <div class="flex-1">
      <RouterView />
    </div>
    <MobileNav />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import MobileNav from '@/components/MobileNav.vue'
import DesktopNav from '@/components/DesktopNav.vue'
</script>
