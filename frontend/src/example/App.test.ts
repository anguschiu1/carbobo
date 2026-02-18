import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../App.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', name: 'home', component: { template: '<div>Dashboard</div>' } }],
})

describe('App', () => {
  it('renders without crashing', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })
    await router.isReady()
    expect(wrapper.exists()).toBe(true)
  })
})

