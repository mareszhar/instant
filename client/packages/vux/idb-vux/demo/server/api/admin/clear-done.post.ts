import { createError, readBody } from 'h3'
import { getAdminDb } from '../../utils/instantAdmin'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ workspaceId?: unknown }>(event)
  const workspaceId = body?.workspaceId

  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required body field: workspaceId',
    })
  }

  const adminDb = getAdminDb(event)

  try {
    const data = await adminDb.query({
      tasks: {
        $: {
          where: {
            'workspace.id': workspaceId,
            'isDone': true,
          },
          limit: 500,
        },
      },
    } as const)

    const deletions = data.tasks.map(task => adminDb.tx.tasks[task.id]!.delete())

    if (deletions.length > 0)
      await adminDb.transact(deletions)

    return {
      generatedAt: new Date().toISOString(),
      mode: 'live' as const,
      deletedCount: deletions.length,
      warning: '',
    }
  }
  catch {
    return {
      generatedAt: new Date().toISOString(),
      mode: 'degraded' as const,
      deletedCount: 0,
      warning: 'Instant Admin API request failed from the Nuxt server in this environment.',
    }
  }
})
