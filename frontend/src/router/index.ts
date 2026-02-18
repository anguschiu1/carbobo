import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/Register.vue'),
  },
  {
    path: '/vehicles/new',
    name: 'vehicle-new',
    component: () => import('@/views/VehicleForm.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vehicles/:id/edit',
    name: 'vehicle-edit',
    component: () => import('@/views/VehicleForm.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vehicles/:vehicleId/fuel',
    name: 'fuel-history',
    component: () => import('@/views/FuelHistory.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vehicles/:vehicleId/fuel/new',
    name: 'fuel-entry-new',
    component: () => import('@/views/FuelEntry.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vehicles/:vehicleId/fuel/:entryId/edit',
    name: 'fuel-entry-edit',
    component: () => import('@/views/FuelEntry.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vehicles/:vehicleId/health-scans',
    name: 'health-scans',
    component: () => import('@/views/HealthScans.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vehicles/:vehicleId/health-scans/new',
    name: 'health-scan-new',
    component: () => import('@/views/HealthScan.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vehicles/:vehicleId/documents',
    name: 'documents',
    component: () => import('@/views/Documents.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vehicles/:vehicleId/reminders',
    name: 'reminders',
    component: () => import('@/views/Reminders.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/fuel-prices',
    name: 'fuel-prices',
    component: () => import('@/views/FuelPrices.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vehicles/:vehicleId/resale-pack',
    name: 'resale-pack',
    component: () => import('@/views/ResalePack.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/resale-pack/:shareId',
    name: 'resale-pack-public',
    component: () => import('@/views/ResalePackPublic.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Auth guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router
