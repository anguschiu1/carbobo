<template>
  <div class="container mx-auto p-4 space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Reminders</h1>
      <Button @click="showForm = true">Add Reminder</Button>
    </div>

    <!-- Add/Edit Form -->
    <Card v-if="showForm" class="p-4">
      <h2 class="text-lg font-semibold mb-4">
        {{ editingReminder ? 'Edit Reminder' : 'Add Reminder' }}
      </h2>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="space-y-2">
          <Label for="type">Reminder Type</Label>
          <Select id="type" v-model="form.type" required>
            <option value="mot">MOT</option>
            <option value="service">Service</option>
            <option value="insurance">Insurance</option>
          </Select>
        </div>
        <div class="space-y-2">
          <Label for="due_date">Due Date</Label>
          <Input
            id="due_date"
            v-model="form.due_date"
            type="date"
            required
          />
        </div>
        <div class="space-y-2">
          <Label for="notes">Notes (Optional)</Label>
          <Input id="notes" v-model="form.notes" placeholder="Additional notes..." />
        </div>
        <div v-if="error" class="text-sm text-destructive">{{ error }}</div>
        <div class="flex gap-2">
          <Button type="submit" :disabled="loading">
            {{ loading ? 'Saving...' : 'Save' }}
          </Button>
          <Button type="button" variant="outline" @click="cancelForm">Cancel</Button>
        </div>
      </form>
    </Card>

    <!-- Reminders List -->
    <div v-if="reminders.length === 0" class="text-center py-12 text-muted-foreground">
      No reminders yet. Add your first reminder!
    </div>

    <div v-else class="space-y-4">
      <Card
        v-for="reminder in reminders"
        :key="reminder.id"
        class="p-4"
        :class="{ 'opacity-60': reminder.is_completed }"
      >
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold">{{ getTypeLabel(reminder.type) }}</h3>
              <span
                v-if="reminder.is_completed"
                class="text-xs bg-green-500 text-white px-2 py-1 rounded"
              >
                Completed
              </span>
              <span
                v-else-if="isOverdue(reminder.due_date)"
                class="text-xs bg-destructive text-white px-2 py-1 rounded"
              >
                Overdue
              </span>
            </div>
            <p class="text-sm text-muted-foreground">
              Due: {{ format(new Date(reminder.due_date), 'MMM d, yyyy') }}
            </p>
            <p v-if="reminder.notes" class="text-sm mt-1">{{ reminder.notes }}</p>
          </div>
          <div class="flex gap-2">
            <Button
              v-if="!reminder.is_completed"
              variant="outline"
              size="sm"
              @click="markComplete(reminder.id)"
            >
              Mark Complete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              @click="editReminder(reminder)"
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              @click="handleDelete(reminder.id)"
              :disabled="deleting === reminder.id"
            >
              {{ deleting === reminder.id ? '...' : 'Delete' }}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import apiClient from '@/api/client'
import { format, isPast, parseISO } from 'date-fns'
import type { Reminder, ReminderType } from '@carbobo/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

const route = useRoute()
const vehicleId = route.params.vehicleId as string

const reminders = ref<Reminder[]>([])
const showForm = ref(false)
const editingReminder = ref<Reminder | null>(null)
const loading = ref(false)
const deleting = ref<string | null>(null)
const error = ref('')

const form = ref<{
  type: ReminderType
  due_date: string
  notes: string
}>({
  type: 'mot',
  due_date: format(new Date(), 'yyyy-MM-dd'),
  notes: '',
})

function getTypeLabel(type: ReminderType): string {
  const labels: Record<ReminderType, string> = {
    mot: 'MOT',
    service: 'Service',
    insurance: 'Insurance',
  }
  return labels[type]
}

function isOverdue(dueDate: string): boolean {
  return isPast(parseISO(dueDate)) && !isPast(parseISO(dueDate + 'T23:59:59'))
}

function editReminder(reminder: Reminder) {
  editingReminder.value = reminder
  form.value = {
    type: reminder.type,
    due_date: format(new Date(reminder.due_date), 'yyyy-MM-dd'),
    notes: reminder.notes || '',
  }
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingReminder.value = null
  form.value = {
    type: 'mot',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  }
}

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    if (editingReminder.value) {
      await apiClient.put(`/reminders/${editingReminder.value.id}`, form.value)
    } else {
      await apiClient.post(`/vehicles/${vehicleId}/reminders`, form.value)
    }
    cancelForm()
    await fetchReminders()
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to save reminder'
  } finally {
    loading.value = false
  }
}

async function markComplete(reminderId: string) {
  try {
    await apiClient.put(`/reminders/${reminderId}`, { is_completed: true })
    await fetchReminders()
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to update reminder'
  }
}

async function handleDelete(reminderId: string) {
  if (!confirm('Are you sure you want to delete this reminder?')) return

  deleting.value = reminderId
  try {
    await apiClient.delete(`/reminders/${reminderId}`)
    await fetchReminders()
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to delete reminder'
  } finally {
    deleting.value = null
  }
}

async function fetchReminders() {
  try {
    const response = await apiClient.get(`/vehicles/${vehicleId}/reminders`)
    reminders.value = response.data.reminders || []
  } catch (error) {
    console.error('Failed to fetch reminders:', error)
  }
}

onMounted(async () => {
  await fetchReminders()
})
</script>
