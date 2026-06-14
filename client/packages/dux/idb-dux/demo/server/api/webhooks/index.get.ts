export default defineEventHandler(async (event) => {
  const { adminDb } = await useServerIdb(event)

  const [errorListing, webhooks] = await go(adminDb.webhooks.manager.list())

  return {
    generatedAt: new Date().toISOString(),
    webhooks: webhooks ?? [],
    recentChanges: recentWebhookChanges,
    warning: errorListing ? formatError(errorListing) : null,
  }
})
