export default defineEventHandler(async (event) => {
  const { adminDb } = await useServerIdb(event)

  // The receiver URL comes from the client so a tunnel/deploy origin can be
  // used — Instant only accepts a *public* host, so localhost is rejected.
  const body = await readBody<{ url?: string }>(event).catch(() => ({} as { url?: string }))
  const url = body.url?.trim()
  if (!url)
    return { ok: false, warning: 'A webhook URL is required.', webhook: null }

  const [errorCreating, webhook] = await go(adminDb.webhooks.manager.create({
    url,
    namespaces: ['tasks', 'workspaces'],
    actions: ['create', 'update', 'delete'],
  }))

  // Return 200 with the reason in the body (not a 4xx) so the panel can show
  // *why* — e.g. "url must be a public host" when run from localhost.
  return {
    ok: !errorCreating,
    warning: errorCreating ? formatError(errorCreating) : null,
    webhook: webhook ?? null,
  }
})
