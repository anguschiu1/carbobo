import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '@/api/client'
import type { User } from '@carbobo/shared'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  async function login(email: string, password: string) {
    try {
      const response = await apiClient.post('/auth/login', { email, password })
      token.value = response.data.token
      user.value = response.data.user
      localStorage.setItem('token', response.data.token)
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      }
    }
  }

  async function register(email: string, password: string) {
    try {
      const response = await apiClient.post('/auth/register', { email, password })
      token.value = response.data.token
      user.value = response.data.user
      localStorage.setItem('token', response.data.token)
      return { success: true }
    } catch (error: any) {
      const message =
        error.response?.data?.error ||
        (error.code === 'ERR_NETWORK' ? 'Cannot reach server. Is the backend running?' : 'Registration failed')
      return { success: false, error: message }
    }
  }

  async function fetchUser() {
    try {
      const response = await apiClient.get('/auth/me')
      user.value = response.data.user
      return { success: true }
    } catch (error: any) {
      logout()
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch user',
      }
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  // Initialize user if token exists
  if (token.value) {
    fetchUser()
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    register,
    fetchUser,
    logout,
  }
})
