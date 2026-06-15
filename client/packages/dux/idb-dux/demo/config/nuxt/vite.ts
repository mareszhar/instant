import type { NuxtConfig } from '@nuxt/schema'

export const vite = {
  optimizeDeps: {
    include: [
      '@floating-ui/vue',
      'go-go-try',
    ],
  },
} satisfies NuxtConfig['vite']
