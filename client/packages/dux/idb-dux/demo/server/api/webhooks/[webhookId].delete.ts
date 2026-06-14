export default defineEventHandler(async (event) => {
  const webhookId = getRouterParam(event, 'webhookId')
  if (!webhookId)
    throw createError({ statusCode: 400, statusMessage: 'Missing webhookId' })

  const { adminDb } = await useServerIdb(event)
  const [errorDeleting] = await go(adminDb.webhooks.manager.delete(webhookId))

  // 200 with the reason in the body so the panel can surface it.
  return {
    ok: !errorDeleting,
    warning: errorDeleting ? formatError(errorDeleting) : null,
  }
})
