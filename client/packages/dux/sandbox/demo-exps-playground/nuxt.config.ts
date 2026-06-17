import { typescript, vite } from './config/nuxt'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-07-15',
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@vueuse/nuxt'],
  ssr: true,

  runtimeConfig: {
    public: {
      instantAppId: '',
    },
    instantAppAdminToken: '',
  },

  typescript,
  vite,
})
