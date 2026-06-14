export default defineEventHandler(async (event) => {
  const workspaceId = expectWorkspaceId(event)
  const { adminDb } = await useServerIdb(event)

  const workspaceDataPromise = go(adminDb.query({
    memberships: {
      $: { where: { workspace: workspaceId }, fields: ['id'] },
    },
    tasks: {
      $: { where: { workspace: workspaceId }, fields: ['isDone'] },
    },
  }))
  const userPromise = useServerIdb(event, 'user?')
  const [[errorQueryingWorkspaceData, workspaceData], { user }] = await Promise.all([workspaceDataPromise, userPromise])

  let countOfTasksDone = 0
  let countOfTasksPending = 0

  for (const task of workspaceData?.tasks ?? []) {
    if (task.isDone)
      countOfTasksDone++
    else
      countOfTasksPending++
  }

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      totalTasks: workspaceData?.tasks.length ?? 0,
      doneTasks: countOfTasksDone,
      pendingTasks: countOfTasksPending,
      memberCount: workspaceData?.memberships.length ?? 0,
    },
    syncedUser: user ? userToLabel(user) : null,
    warning: errorQueryingWorkspaceData ? formatError(errorQueryingWorkspaceData) : null,
  }
})
