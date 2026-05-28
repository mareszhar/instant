export default defineEventHandler(async (event) => {
  const workspaceId = expectWorkspaceId(event)
  const { userDb } = useIdbn(event, 'userDb!')

  const [errorGettingWorkspaceData, workspaceQuery] = await go(userDb.query(q({
    workspaces: {
      $: {
        where: { id: workspaceId },
        fields: ['id'],
      },
      tasks: {
        $: {
          where: { isDone: true },
          fields: ['id'],
          limit: 500,
        },
      },
    },
  })))

  const workspace = workspaceQuery?.workspaces[0] ?? null
  const tasksDone = workspace?.tasks ?? []
  const [errorDeletingTasksDone] = tasksDone.length > 0
    ? await go(userDb.transact(tasksDone.map(task => userDb.tx.tasks[task.id]!.delete())))
    : [undefined]

  return {
    generatedAt: new Date().toISOString(),
    countOfTasksDoneDeleted: errorDeletingTasksDone ? 0 : tasksDone.length,
    warning: (errorGettingWorkspaceData || errorDeletingTasksDone)
      ? formatError(errorGettingWorkspaceData ?? errorDeletingTasksDone)
      : null,
  }
})
