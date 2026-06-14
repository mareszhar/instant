import { defineServerKit } from '@mszr/idb-dux/nuxt'
import schema from '~~/config/instant.schema'

// One factory at module scope; one `await useServerIdb(event, mode)` per route.
// `dux`'s server kit owns the admin db internally — no `init` to wire, no token
// reading or 401 boilerplate. The mode declares auth strictness and the kit's
// keys follow ([dux-spec-nuxt.md §2]).
export const useServerIdb = defineServerKit({
  schema,
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
  getAdminToken: event => useRuntimeConfig(event).instantAppAdminToken,
})
