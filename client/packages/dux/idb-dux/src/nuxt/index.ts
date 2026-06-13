/**
 * `@mszr/idb-dux/nuxt` — h3/nitro/Nuxt server glue.
 *
 * `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler` — thin h3
 * wiring over the `/admin` and `/webhooks` layers; it owns no data-plane or
 * verification logic of its own.
 *
 * Spec: `../../../docs/dux-spec-nuxt.md`.
 */

// The official first-party route handler, for apps that want the official
// cookie shape (and official `getUserFromRequest` compatibility). Reached
// through the admin layer — `/nuxt` never imports `@instantdb/admin` directly.
export {
  createInstantRouteHandler,
  type InstantRouteHandlerBody,
  type InstantRouteHandlerPayloadByType,
  type InstantRouteHandlerType,
} from '../admin/index.js'
export { defineAuthSyncHandler } from './defineAuthSyncHandler.js'
export { defineServerKit } from './defineServerKit.js'
export { defineWebhookHandler } from './defineWebhookHandler.js'
export type {
  IdbAuthSyncConfig,
  IdbServerKit,
  IdbServerKitConfig,
  IdbServerKitFactory,
  IdbServerKitMode,
} from './types.js'
