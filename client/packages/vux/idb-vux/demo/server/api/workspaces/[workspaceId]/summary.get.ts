export default defineEventHandler(async (event) => {
  const workspaceId = expectWorkspaceId(event)
  const { adminDb } = useIdbn(event)

  const workspacePromise = go(adminDb.query(q({
    workspaces: {
      $: {
        where: { id: workspaceId },
        fields: ['id'],
      },
      memberships: { $: { fields: ['id'] } },
      tasks: { $: { fields: ['isDone'] } },
    },
  })))
  const userPromise = useIdbn(event, 'user?')
  const [[errorGettingWorkspaceData, workspaceQuery], { user }] = await Promise.all([workspacePromise, userPromise])

  const workspace = workspaceQuery?.workspaces[0] ?? null
  let countOfTasksDone = 0
  let countOfTasksPending = 0

  for (const task of workspace?.tasks ?? []) {
    if (task.isDone)
      countOfTasksDone++
    else
      countOfTasksPending++
  }

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      totalTasks: workspace?.tasks.length ?? 0,
      doneTasks: countOfTasksDone,
      pendingTasks: countOfTasksPending,
      memberCount: workspace?.memberships.length ?? 0,
    },
    syncedUser: user ? userToLabel(user) : null,
    warning: errorGettingWorkspaceData ? formatError(errorGettingWorkspaceData) : null,
  }
})
