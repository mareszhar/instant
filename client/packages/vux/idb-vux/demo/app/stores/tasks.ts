export const useTasks = defineStore('tasks', () => {
  const { db, auth } = useIdb()
  const workspaces = useWorkspaces()

  const form = reactive({
    title: '',
    isProcessing: false,
    feedback: null as Feedback | null,
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

  const byStatus = computed(() => ({
    all: available.value,
    pending: available.value.filter(task => !task.isDone),
    done: available.value.filter(task => task.isDone),
  }))

  const statusFilters = ['all', 'pending', 'done'] as const
  const activeStatusFilter = useStoreSessionStorage<typeof statusFilters[number]>('tasks-status-filter', 'all')
  const setActiveStatusFilter = (status: typeof activeStatusFilter.value) => activeStatusFilter.value = status
  const shown = computed(() => byStatus.value[activeStatusFilter.value])

  const create = () => executeFormAction(form, !form.title || !workspaces.current?.id, async () => {
    await db.transact(db.tx.tasks[id()]!.create({
      title: form.title,
      isDone: false,
      createdAt: Date.now(),
    }).link({ workspace: workspaces.current!.id }))

    form.title = ''
  })

  const toggleCheck = (task: Task) => executeFormAction(form, false, () =>
    db.transact(db.tx.tasks[task.id]!.update({ isDone: !task.isDone })))

  const toggleClaim = (task: TaskWithAssignee) => executeFormAction(form, !auth.user?.id, () =>
    db.transact(db.tx.tasks[task.id]![task.assignee?.id === auth.user!.id ? 'unlink' : 'link']({
      assignee: auth.user!.id,
    })))

  const remove = (task: Task) => executeFormAction(form, false, () =>
    db.transact(db.tx.tasks[task.id]!.delete()))

  const removeDone = () => executeFormAction(form, !byStatus.value.done.length, async () => {
    const doneCount = byStatus.value.done.length
    await db.transact(byStatus.value.done.map(task => db.tx.tasks[task.id]!.delete()))
    return `Deleted ${doneCount} completed task${doneCount !== 1 ? 's' : ''}.`
  })

  return {
    form,
    isLoading,
    error,
    available,
    byStatus,
    statusFilters,
    activeStatusFilter,
    setActiveStatusFilter,
    shown,
    create,
    toggleCheck,
    toggleClaim,
    remove,
    removeDone,
  }
})
