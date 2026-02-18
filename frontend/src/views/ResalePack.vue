<template>
  <div class="container mx-auto p-4 space-y-6">
    <Card class="p-6">
      <h1 class="text-3xl font-bold mb-4">Resale Pack</h1>
      <p class="text-muted-foreground mb-4">
        Generate a shareable link to showcase your vehicle's maintenance history and evidence.
      </p>

      <div v-if="shareUrl" class="space-y-4">
        <div class="p-4 bg-muted rounded-lg">
          <p class="text-sm font-semibold mb-2">Share Link:</p>
          <div class="flex gap-2">
            <Input :value="fullShareUrl" readonly class="flex-1" />
            <Button @click="copyToClipboard">Copy</Button>
          </div>
        </div>
        <div v-if="copied" class="text-sm text-green-600">Link copied to clipboard!</div>
        <Button variant="outline" @click="shareUrl = null">Generate New Link</Button>
      </div>

      <Button v-else @click="generateShareLink" :disabled="loading">
        {{ loading ? 'Generating...' : 'Generate Share Link' }}
      </Button>

      <div v-if="error" class="text-sm text-destructive mt-4">{{ error }}</div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import apiClient from '@/api/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const route = useRoute()
const vehicleId = route.params.vehicleId as string

const shareUrl = ref<string | null>(null)
const loading = ref(false)
const error = ref('')
const copied = ref(false)

const fullShareUrl = computed(() => {
  if (!shareUrl.value) return ''
  const baseUrl = window.location.origin
  return `${baseUrl}${shareUrl.value}`
})

async function generateShareLink() {
  error.value = ''
  loading.value = true

  try {
    const response = await apiClient.post(`/vehicles/${vehicleId}/resale-pack/generate`)
    shareUrl.value = response.data.share_url
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to generate share link'
  } finally {
    loading.value = false
  }
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(fullShareUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>
