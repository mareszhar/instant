import type { NuxtConfig } from '@nuxt/schema'

export const vite = {
  optimizeDeps: {
    include: [
      '@floating-ui/vue',
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
