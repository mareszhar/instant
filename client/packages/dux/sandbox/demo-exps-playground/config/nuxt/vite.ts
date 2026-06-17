import type { NuxtConfig } from '@nuxt/schema'

export const vite = {
  optimizeDeps: {
    include: [
      'go-go-try',
    ],
    exclude: [
      '@mszr/idb-dux',
    ],
  },
  resolve: {
    preserveSymlinks: true,
  },
} satisfies NuxtConfig['vite']
