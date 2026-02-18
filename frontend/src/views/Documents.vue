<template>
  <div class="container mx-auto p-4 space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Document Vault</h1>
      <Button @click="showUploadForm = true">Upload Document</Button>
    </div>

    <!-- Upload Form -->
    <Card v-if="showUploadForm" class="p-4">
      <h2 class="text-lg font-semibold mb-4">Upload Document</h2>
      <form @submit.prevent="handleUpload" class="space-y-4">
        <div class="space-y-2">
          <Label for="type">Document Type</Label>
          <Select id="type" v-model="uploadForm.type" required>
            <option value="service_invoice">Service Invoice</option>
            <option value="mot_certificate">MOT Certificate</option>
            <option value="repair_receipt">Repair Receipt</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div class="space-y-2">
          <Label for="occurred_at">Date</Label>
          <Input
            id="occurred_at"
            v-model="uploadForm.occurred_at"
            type="date"
            required
          />
        </div>
        <div class="space-y-2">
          <Label for="file">File</Label>
          <Input
            id="file"
            type="file"
            accept="image/*,application/pdf"
            @change="handleFileChange"
            required
          />
        </div>
        <div class="space-y-2">
          <Label for="notes">Notes (Optional)</Label>
          <Input id="notes" v-model="uploadForm.notes" placeholder="Additional notes..." />
        </div>
        <div v-if="error" class="text-sm text-destructive">{{ error }}</div>
        <div class="flex gap-2">
          <Button type="submit" :disabled="loading">
            {{ loading ? 'Uploading...' : 'Upload' }}
          </Button>
          <Button type="button" variant="outline" @click="showUploadForm = false">
            Cancel
          </Button>
        </div>
      </form>
    </Card>

    <!-- Documents List -->
    <div v-if="documents.length === 0" class="text-center py-12 text-muted-foreground">
      No documents yet. Upload your first document!
    </div>

    <div v-else class="space-y-4">
      <div class="space-y-2">
        <Label for="filter">Filter by Type</Label>
        <Select id="filter" v-model="filterType">
          <option value="">All Types</option>
          <option value="service_invoice">Service Invoice</option>
          <option value="mot_certificate">MOT Certificate</option>
          <option value="repair_receipt">Repair Receipt</option>
          <option value="other">Other</option>
        </Select>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card v-for="doc in filteredDocuments" :key="doc.id" class="p-4">
          <div class="space-y-2">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-semibold">{{ getTypeLabel(doc.type) }}</h3>
                <p class="text-sm text-muted-foreground">
                  {{ format(new Date(doc.occurred_at), 'MMM d, yyyy') }}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                @click="handleDelete(doc.id)"
                :disabled="deleting === doc.id"
              >
                {{ deleting === doc.id ? '...' : 'Delete' }}
              </Button>
            </div>
            <p v-if="doc.notes" class="text-sm">{{ doc.notes }}</p>
            <a
              :href="getFileUrl(doc.file_url)"
              target="_blank"
              class="text-sm text-primary hover:underline"
            >
              View Document →
            </a>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import apiClient from '@/api/client'
import { format } from 'date-fns'
import type { Document, DocumentType } from '@carbobo/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

const route = useRoute()
const vehicleId = route.params.vehicleId as string

const documents = ref<Document[]>([])
const showUploadForm = ref(false)
const loading = ref(false)
const deleting = ref<string | null>(null)
const error = ref('')
const filterType = ref<DocumentType | ''>('')

const uploadForm = ref<{
  type: DocumentType
  occurred_at: string
  file: File | null
  notes: string
}>({
  type: 'service_invoice',
  occurred_at: format(new Date(), 'yyyy-MM-dd'),
  file: null,
  notes: '',
})

const filteredDocuments = computed(() => {
  if (!filterType.value) return documents.value
  return documents.value.filter((doc) => doc.type === filterType.value)
})

function getTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    service_invoice: 'Service Invoice',
    mot_certificate: 'MOT Certificate',
    repair_receipt: 'Repair Receipt',
    other: 'Other',
  }
  return labels[type]
}

function getFileUrl(url: string): string {
  if (url.startsWith('http')) return url
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${apiUrl}${url}`
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  uploadForm.value.file = target.files?.[0] || null
}

async function handleUpload() {
  error.value = ''
  loading.value = true

  try {
    const formData = new FormData()
    if (uploadForm.value.file) {
      formData.append('file', uploadForm.value.file)
    }
    formData.append('type', uploadForm.value.type)
    formData.append('occurred_at', uploadForm.value.occurred_at)
    if (uploadForm.value.notes) {
      formData.append('notes', uploadForm.value.notes)
    }

    await apiClient.post(`/vehicles/${vehicleId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    // Reset form and refresh list
    uploadForm.value = {
      type: 'service_invoice',
      occurred_at: format(new Date(), 'yyyy-MM-dd'),
      file: null,
      notes: '',
    }
    showUploadForm.value = false
    await fetchDocuments()
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to upload document'
  } finally {
    loading.value = false
  }
}

async function handleDelete(docId: string) {
  if (!confirm('Are you sure you want to delete this document?')) return

  deleting.value = docId
  try {
    await apiClient.delete(`/vehicles/${vehicleId}/documents/${docId}`)
    await fetchDocuments()
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to delete document'
  } finally {
    deleting.value = null
  }
}

async function fetchDocuments() {
  try {
    const response = await apiClient.get(`/vehicles/${vehicleId}/documents`)
    documents.value = response.data.documents || []
  } catch (error) {
    console.error('Failed to fetch documents:', error)
  }
}

onMounted(async () => {
  await fetchDocuments()
})
</script>
