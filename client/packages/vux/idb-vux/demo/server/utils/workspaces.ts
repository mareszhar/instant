import type { H3Event } from 'h3'

export function expectWorkspaceId(event: H3Event) {
  const workspaceId = event.context.params?.workspaceId

  if (workspaceId)
    return workspaceId

  throw createError({
    statusCode: 400,
    statusMessage: 'Missing required query param: workspaceId',
  })
}
