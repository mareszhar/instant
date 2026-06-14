import { defineWebhookHandler } from '@mszr/idb-dux/nuxt'

// The one route that *receives* deliveries: read raw body → verify signature →
// fetch payload → dispatch to the handlers. Admin-free by design — verification
// uses Instant's public JWKS and the token the body carries.
export default defineWebhookHandler(webhookHandlers)
