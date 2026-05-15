import { typescript } from './config/nuxt/typescript'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-05-05',
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@vueuse/nuxt'],

  runtimeConfig: {
    public: {
      instantAppId: '',
    },
    instantAppAdminToken: '',
  },

  vite: {
    resolve: {
      preserveSymlinks: true,
    },
    optimizeDeps: {
      exclude: [
        '@mszr/idb-vux',
      ],
    },
  },

  typescript,
})
