import type { NuxtConfig } from '@nuxt/schema'

export const typescript = {
  // https://nuxt.com/docs/4.x/api/nuxt-config#typescript
  strict: true,
  tsConfig: {
    vueCompilerOptions: {
      plugins: ['@vue/language-plugin-pug'],
    },
  },
} satisfies NuxtConfig['typescript']
