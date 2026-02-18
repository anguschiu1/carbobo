import { defineStore } from 'pinia'
import { ref } from 'vue'
import apiClient from '@/api/client'
import type { Vehicle } from '@carbobo/shared'

export const useVehiclesStore = defineStore('vehicles', () => {
  const vehicles = ref<Vehicle[]>([])
  const currentVehicle = ref<Vehicle | null>(null)
  const loading = ref(false)

  async function fetchVehicles() {
    loading.value = true
    try {
      const response = await apiClient.get('/vehicles')
      vehicles.value = response.data.vehicles || []
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch vehicles',
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchVehicle(id: string) {
    loading.value = true
    try {
      const response = await apiClient.get(`/vehicles/${id}`)
      currentVehicle.value = response.data.vehicle
      return { success: true, vehicle: response.data.vehicle }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch vehicle',
      }
    } finally {
      loading.value = false
    }
  }

  async function createVehicle(vehicleData: Partial<Vehicle>) {
    loading.value = true
    try {
      const response = await apiClient.post('/vehicles', vehicleData)
      vehicles.value.push(response.data.vehicle)
      return { success: true, vehicle: response.data.vehicle }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create vehicle',
      }
    } finally {
      loading.value = false
    }
  }

  async function updateVehicle(id: string, vehicleData: Partial<Vehicle>) {
    loading.value = true
    try {
      const response = await apiClient.put(`/vehicles/${id}`, vehicleData)
      const index = vehicles.value.findIndex((v) => v.id === id)
      if (index !== -1) {
        vehicles.value[index] = response.data.vehicle
      }
      if (currentVehicle.value?.id === id) {
        currentVehicle.value = response.data.vehicle
      }
      return { success: true, vehicle: response.data.vehicle }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update vehicle',
      }
    } finally {
      loading.value = false
    }
  }

  async function deleteVehicle(id: string) {
    loading.value = true
    try {
      await apiClient.delete(`/vehicles/${id}`)
      vehicles.value = vehicles.value.filter((v) => v.id !== id)
      if (currentVehicle.value?.id === id) {
        currentVehicle.value = null
      }
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete vehicle',
      }
    } finally {
      loading.value = false
    }
  }

  return {
    vehicles,
    currentVehicle,
    loading,
    fetchVehicles,
    fetchVehicle,
    createVehicle,
    updateVehicle,
    deleteVehicle,
  }
})
