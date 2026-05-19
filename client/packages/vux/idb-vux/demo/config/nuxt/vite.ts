import type { NuxtConfig } from '@nuxt/schema'

export const vite = {
  // https://nuxt.com/docs/4.x/api/nuxt-config#vite
  resolve: {
    preserveSymlinks: true,
  },
  optimizeDeps: {
    exclude: [
      '@mszr/idb-vux',
    ],
    include: [
      'go-go-try',
    ],
  },
} satisfies NuxtConfig['vite']
