<template>
  <div :class="cn('relative flex w-full touch-none select-none items-center', props.class)">
    <input
      :id="inputId"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="handleInput"
      class="peer h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary"
    />
    <div class="absolute h-2 w-full rounded-lg bg-secondary" />
    <div
      class="absolute h-2 rounded-lg bg-primary"
      :style="{ width: `${((modelValue - min) / (max - min)) * 100}%` }"
    />
    <div
      class="absolute h-4 w-4 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      :style="{ left: `${((modelValue - min) / (max - min)) * 100}%`, marginLeft: '-8px' }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue: number
  min?: number
  max?: number
  step?: number
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const inputId = computed(() => `slider-${Math.random().toString(36).substr(2, 9)}`)

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', Number(target.value))
}
</script>
