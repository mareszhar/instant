export default defineEventHandler(async (event) => {
  const workspaceId = expectWorkspaceId(event)
  const { userDb } = useIdbn(event, 'userDb!')

  const [errorQueryingTasksDone, tasksDoneQuery] = await go(userDb.query(q({
    tasks: {
      $: {
        where: { workspace: workspaceId, isDone: true },
        fields: ['id'],
        limit: 500,
      },
    },
  })))

  const tasksDone = tasksDoneQuery?.tasks ?? []
  const [errorDeletingTasksDone] = tasksDone.length > 0
    ? await go(userDb.transact(tasksDone.map(task => userDb.tx.tasks[task.id]!.delete())))
    : [undefined]

  return {
    generatedAt: new Date().toISOString(),
    countOfTasksDoneDeleted: errorDeletingTasksDone ? 0 : tasksDone.length,
    warning: (errorQueryingTasksDone || errorDeletingTasksDone)
      ? formatError(errorQueryingTasksDone ?? errorDeletingTasksDone)
      : null,
  }
})
