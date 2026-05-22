export const useTasks = defineStore('tasks', () => {
  const { db, auth } = useIdb()
  const workspaces = useWorkspaces()

  const form = reactive({
    title: '',
    isProcessing: false,
    feedback: useEphemeralFeedback(),
  })

  const { isLoading, error, tasks: available } = db.useQueryX(() => q({
    tasks: {
      $: {
        where: { workspace: workspaces.current?.id },
        order: { createdAt: 'desc' },
      },
      assignee: {},
    },
  }))

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

  const updateCheck = (task: Task) =>
    db.transact(db.tx.tasks[task.id]!.update({ isDone: !task.isDone }))

  const updateClaim = (task: TaskWithAssignee) =>
    db.transact(db.tx.tasks[task.id]![task.assignee?.id === auth.user!.id ? 'unlink' : 'link']({
      assignee: auth.user!.id,
    }))

  const removeOne = (task: Task) =>
    db.transact(db.tx.tasks[task.id]!.delete())

  const create = () => executeFormAction(form, !auth.user?.id || !form.title || !workspaces.current?.id, async () => {
    await db.transact(db.tx.tasks[id()]!.create({
      title: form.title,
      isDone: false,
      createdAt: Date.now(),
    }).link({ workspace: workspaces.current!.id }))

    form.title = ''
  })

  const toggleCheck = (task: Task) =>
    executeFormAction(form, !auth.user?.id, () => updateCheck(task))

  const toggleClaim = (task: TaskWithAssignee) =>
    executeFormAction(form, !auth.user?.id, () => updateClaim(task))

  const remove = (task: Task) =>
    executeFormAction(form, !auth.user?.id, () => removeOne(task))

  const removeDone = () => executeFormAction(form, !byStatus.done.length, async () => {
    const doneCount = byStatus.done.length
    await db.transact(byStatus.done.map(task => db.tx.tasks[task.id]!.delete()))
    return `Deleted ${doneCount} completed task${doneCount !== 1 ? 's' : ''}.`
  })

  return {
    form,
    isLoading,
    error,
    available,
    statusFilters,
    activeStatusFilter,
    setActiveStatusFilter,
    groupByStatus,
    byStatus,
    shown,
    updateCheck,
    updateClaim,
    removeOne,
    create,
    toggleCheck,
    toggleClaim,
    remove,
    removeDone,
  }
})
