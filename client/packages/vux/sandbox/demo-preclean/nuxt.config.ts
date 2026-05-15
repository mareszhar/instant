export default defineNuxtConfig({
  compatibilityDate: '2026-04-17',
  ssr: true,
  devtools: { enabled: true },
  telemetry: false,
  modules: ['@pinia/nuxt', '@vueuse/nuxt'],
  runtimeConfig: {
    public: {
      instantAppId: '',
    },
    instantAppAdminToken: '',
  },
  typescript: {
    strict: true,
    tsConfig: {
      vueCompilerOptions: {
        plugins: ['@vue/language-plugin-pug'],
      },
    },
  },
  vite: {
    resolve: {
      preserveSymlinks: true,
    },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (
            warning.code === 'SOURCEMAP_BROKEN'
            && warning.plugin === 'nuxt:module-preload-polyfill'
          ) {
            return
          }

          warn(warning)
        },
      },
    },
  },
})
