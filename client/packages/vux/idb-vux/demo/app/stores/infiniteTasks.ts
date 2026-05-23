export const useInfiniteTasksStore = defineStore('infinite-tasks', () => {
  const { db, auth } = useIdb()
  const workspaces = useWorkspaces()
  const tasks = useTasks()

  const form = reactive({
    isProcessing: false,
    feedback: useEphemeralFeedback(),
  })

  const activeStatusFilter = useStoreSessionStorage<typeof tasks.statusFilters[number]>('infinite-tasks-status-filter', 'all')
  const setActiveStatusFilter = (status: typeof activeStatusFilter.value) => activeStatusFilter.value = status
  const pageSizes = [3, 5, 10] as const
  const activePageSize = useStoreSessionStorage<typeof pageSizes[number]>('infinite-tasks-page-size', 5)
  const setActivePageSize = (pageSize: typeof activePageSize.value) => activePageSize.value = pageSize

  const {
    isLoading,
    error,
    tasks: available,
    canLoadNextPage,
    loadNextPage,
  } = db.useInfiniteQueryX(() => tasks.query('asc', activePageSize.value))

  const byStatus = reactiveComputed(() => tasks.groupByStatus(available.value))
  const shown = computed(() => byStatus[activeStatusFilter.value])

  const toggleCheck = (task: Task) => tasks.toggleCheck(task, form)
  const toggleClaim = (task: TaskWithAssignee) => tasks.toggleClaim(task, form)
  const remove = (task: Task) => tasks.remove(task, form)

  const seedSample = (quantity: number) => executeFormAction(form, !auth.user?.id || !workspaces.current, async () => {
    const now = Date.now()
    let currentTaskNumber = tasks.available.length + 1
    const transactions = Array.from({ length: quantity }, (_, index) => {
      const taskId = id()
      const isDone = index % 3 === 0

      return [
        db.tx.tasks[taskId]!.create({
          title: `Sample task ${String(currentTaskNumber++).padStart(2, '0')}`,
          isDone,
          createdAt: now + index,
        }).link({ workspace: workspaces.current!.id }),
        ...(index % 2 === 0 ? [db.tx.tasks[taskId]!.link({ assignee: auth.user!.id })] : []),
      ]
    }).flat()

    await db.transact(transactions)
    return `Seeded ${quantity} sample task${quantity !== 1 ? 's' : ''}`
  })

  const clearSeeded = () => executeFormAction(form, !workspaces.current, async () => {
    const { tasks: seededTasks } = await db.queryOnceX({
      tasks: {
        $: {
          where: { workspace: workspaces.current!.id, title: { $like: 'Sample task %' } },
          limit: 500,
        },
      },
    })

    if (!seededTasks.length)
      return 'No seeded sample tasks found.'

    await db.transact(seededTasks.map(task => db.tx.tasks[task.id]!.delete()))
    return `Deleted ${seededTasks.length} seeded task${seededTasks.length !== 1 ? 's' : ''}.`
  })

  return {
    form,
    statusFilters: tasks.statusFilters,
    activeStatusFilter,
    setActiveStatusFilter,
    pageSizes,
    activePageSize,
    setActivePageSize,
    isLoading,
    error,
    available,
    canLoadNextPage,
    loadNextPage,
    byStatus,
    shown,
    toggleCheck,
    toggleClaim,
    remove,
    seedSample,
    clearSeeded,
  }
})
