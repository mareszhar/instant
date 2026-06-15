import { defineServerKit } from '@mszr/idb-dux/nuxt'
import schema from '~~/config/instant.schema'

// One factory at module scope; one `await useServerIdb(event, mode)` per route.
// `dux`'s server kit owns the admin db internally — no `init` to wire, no token
// reading or 401 boilerplate. The mode declares auth strictness and the kit's
// keys follow.
// Docs: https://github.com/mareszhar/instant/blob/dux/client/packages/dux/docs/dux-spec-nuxt.md
export const useServerIdb = defineServerKit({
  schema,
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
  getAdminToken: event => useRuntimeConfig(event).instantAppAdminToken,
})
