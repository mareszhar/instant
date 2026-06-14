export const useTasks = defineStore('tasks', () => {
  const { db, auth } = useIdb()
  const workspaces = useWorkspaces()

  const form = reactive({
    title: '',
    isProcessing: false,
    feedback: useEphemeralFeedback(),
  })

  const query = (createdAtOrder: 'desc' | 'asc' = 'desc', limit?: number) => q({
    tasks: {
      $: {
        where: { workspace: workspaces.current?.id || $skip },
        order: { createdAt: createdAtOrder },
        limit: limit || $skip,
      },
      assignee: {},
    },
  })

  const { isLoading, error, tasks: available } = db.useQuery(() => query())

  const statusFilters = ['all', 'pending', 'done'] as const
  const activeStatusFilter = useStoreSessionStorage<typeof statusFilters[number]>('regular-tasks-status-filter', 'all')
  const setActiveStatusFilter = (status: typeof activeStatusFilter.value) => activeStatusFilter.value = status
  const groupByStatus = <T extends Task>(tasks: T[]) => ({
    all: tasks,
    pending: tasks.filter(task => !task.isDone),
    done: tasks.filter(task => task.isDone),
  })
  const byStatus = reactiveComputed(() => groupByStatus(available.value))
  const shown = computed(() => byStatus[activeStatusFilter.value])

  const create = () => executeFormAction(form, !auth.user?.id || !workspaces.current?.id || !form.title, async () => {
    await db.transact(db.tx.tasks[id()]!.create({
      title: form.title,
      isDone: false,
      createdAt: Date.now(),
      // Denormalized so webhook deliveries can self-attribute to a workspace
      // ([instant.schema.ts]); perms pin it to the linked workspace below.
      workspaceId: workspaces.current!.id,
    }).link({ workspace: workspaces.current!.id }))

    form.title = ''
  })

  const toggleCheck = (task: Task, formState: FormState = form) =>
    executeFormAction(formState, !auth.user?.id, () => db.transact(
      db.tx.tasks[task.id]!.update({ isDone: !task.isDone }),
    ))

  const toggleClaim = (task: TaskWithAssignee, formState: FormState = form) =>
    executeFormAction(formState, !auth.user?.id, () => db.transact(
      db.tx.tasks[task.id]![task.assignee?.id === auth.user!.id ? 'unlink' : 'link']({
        assignee: auth.user!.id,
      }),
    ))

  const remove = (task: Task, formState: FormState = form) =>
    executeFormAction(formState, !auth.user?.id, () => db.transact(
      db.tx.tasks[task.id]!.delete(),
    ))

  const removeDone = () => executeFormAction(form, !byStatus.done.length, async () => {
    const doneCount = byStatus.done.length
    await db.transact(byStatus.done.map(task => db.tx.tasks[task.id]!.delete()))
    return `Deleted ${doneCount} completed task${doneCount !== 1 ? 's' : ''}.`
  })

  return {
    form,
    query,
    isLoading,
    error,
    available,
    statusFilters,
    activeStatusFilter,
    setActiveStatusFilter,
    groupByStatus,
    byStatus,
    shown,
    create,
    toggleCheck,
    toggleClaim,
    remove,
    removeDone,
  }
})
