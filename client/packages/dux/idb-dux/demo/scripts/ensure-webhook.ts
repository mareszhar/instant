/**
 * Provision the demo's single app-owned webhook subscription — idempotently.
 *
 * Instant webhooks are an *app-level* primitive (`url + namespaces + actions`,
 * with no per-user/per-workspace filter), so they are wrong to expose as a
 * visitor action in a shared public demo: one visitor could subscribe their own
 * endpoint, delete another's, or exhaust the app's webhook quota. Instead one
 * subscription is provisioned here, by a maintainer, pointing at the deployed
 * (or tunneled) receiver. The demo then fans deliveries out per workspace
 * ([server/utils/webhooks.ts]) so isolation holds.
 *
 * Usage:
 *   bun run webhook:ensure https://your-deploy.example/api/webhooks/receive
 *   bun run webhook:ensure https://your-tunnel.ngrok.app/api/webhooks/receive
 */
import process from 'node:process'
import { init } from '@mszr/idb-dux/admin'
import schema from '../config/instant.schema'

const receiverUrl = process.argv[2]
if (!receiverUrl) {
  console.error('Usage: bun run webhook:ensure <receiver-url>')
  console.error('  e.g. bun run webhook:ensure https://your-deploy.example/api/webhooks/receive')
  process.exit(1)
}

const appId = process.env.NUXT_PUBLIC_INSTANT_APP_ID
const adminToken = process.env.NUXT_INSTANT_APP_ADMIN_TOKEN
if (!appId || !adminToken) {
  console.error('Missing NUXT_PUBLIC_INSTANT_APP_ID / NUXT_INSTANT_APP_ADMIN_TOKEN (set them in .env).')
  process.exit(1)
}

const adminDb = init({ appId, adminToken, schema })

const existing = await adminDb.webhooks.manager.list()
const already = existing.find(webhook => webhook.sink.url === receiverUrl)

if (already) {
  console.log(`✓ Subscription already points at ${receiverUrl} (status: ${already.status}).`)
}
else {
  const created = await adminDb.webhooks.manager.create({
    url: receiverUrl,
    namespaces: ['tasks'],
    actions: ['create', 'update', 'delete'],
  })
  console.log(`✓ Created subscription ${created.id} → ${receiverUrl} (tasks · create, update, delete).`)
}
