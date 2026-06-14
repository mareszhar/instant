export default defineEventHandler(async (event) => {
  // Read-only, and signed-in only: the subscription is app-owned and
  // provisioned by a maintainer ([scripts/ensure-webhook.ts]) — visitors never
  // create or delete it, they just see that the demo is wired up.
  const { adminDb } = await useServerIdb(event, 'user')

  const [errorListing, webhooks] = await go(adminDb.webhooks.manager.list())

  return {
    generatedAt: new Date().toISOString(),
    // Only the safe config the panel renders — never raw delivery payloads.
    subscriptions: (webhooks ?? []).map(webhook => ({
      url: webhook.sink.url,
      namespaces: webhook.namespaces,
      actions: webhook.actions,
      status: webhook.status,
    })),
    warning: errorListing ? formatError(errorListing) : null,
  }
})
