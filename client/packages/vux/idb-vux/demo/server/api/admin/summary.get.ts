import { createError, getQuery } from 'h3'
import { getAdminDb, getSyncedInstantUser } from '../../utils/instantAdmin'

export default defineEventHandler(async (event) => {
  const workspaceId = getQuery(event).workspaceId
  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required query param: workspaceId',
    })
  }

  const adminDb = getAdminDb(event)
  const syncedUser = await getSyncedInstantUser(event)

  try {
    const data = await adminDb.query({
      tasks: {
        $: {
          where: {
            'workspace.id': workspaceId,
          },
        },
      },
      memberships: {
        $: {
          where: {
            'workspace.id': workspaceId,
          },
        },
      },
    } as const)

    const doneTasks = data.tasks.filter(task => task.isDone).length
    const pendingTasks = data.tasks.length - doneTasks

    return {
      generatedAt: new Date().toISOString(),
      mode: 'live' as const,
      counts: {
        totalTasks: data.tasks.length,
        doneTasks,
        pendingTasks,
        memberCount: data.memberships.length,
      },
      syncedUser,
      warning: '',
    }
  }
  catch {
    return {
      generatedAt: new Date().toISOString(),
      mode: 'degraded' as const,
      counts: {
        totalTasks: 0,
        doneTasks: 0,
        pendingTasks: 0,
        memberCount: 0,
      },
      syncedUser,
      warning: 'Instant Admin API request failed from the Nuxt server in this environment.',
    }
  }
})
