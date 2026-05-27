export default defineEventHandler(async (event) => {
  const { workspaceId } = getQuery<EndpointSummarizeWorkspacePayload>(event)

  if (!workspaceId || typeof workspaceId !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required query param: workspaceId',
    })
  }

  const { adminDb } = useIdbn(event)

  const [errorGettingWorkspaceData, workspaceQuery] = await go(adminDb.query(q({
    workspaces: {
      $: {
        where: { id: workspaceId },
        fields: ['id'],
      },
      memberships: { $: { fields: ['id'] } },
      tasks: { $: { fields: ['isDone'] } },
    },
  })))

  const workspace = workspaceQuery?.workspaces[0] ?? null
  const mode = errorGettingWorkspaceData ? 'degraded' : 'live'
  let countOfTasksDone = 0
  let countOfTasksPending = 0

  for (const task of workspace?.tasks ?? []) {
    if (task.isDone)
      countOfTasksDone++
    else
      countOfTasksPending++
  }

  const { user } = await useIdbn(event, 'user?')
  const generatedAt = new Date().toISOString()

  return {
    generatedAt,
    mode,
    counts: {
      totalTasks: workspace?.tasks.length ?? 0,
      doneTasks: countOfTasksDone,
      pendingTasks: countOfTasksPending,
      memberCount: workspace?.memberships.length ?? 0,
    },
    syncedUser: user,
    warning: errorGettingWorkspaceData ? `[Server error /api/summarizeWorkspace]: ${formatError(errorGettingWorkspaceData)}` : '',
  }
})
