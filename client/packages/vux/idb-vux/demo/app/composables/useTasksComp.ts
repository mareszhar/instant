type Task = InstaQLEntity<AppSchema, 'tasks', {
  assignee: {}
  workspace: {}
}>

type TaskStatusFilter = 'all' | 'pending' | 'done'

const statusFilters: TaskStatusFilter[] = ['all', 'pending', 'done']

export function useTasksComp(workspaceId: string) {
  const db = useDb()
  const auth = db?.useAuth()

  const statusFilter = useSessionStorage<TaskStatusFilter>(
    'idb-vux-demo:tasks:status-filter',
    'all',
  )
  const titleInput = ref('')

  const isMutating = ref(false)
  const actionError = ref('')
  const actionMessage = ref('')
  useEphemeralText(actionMessage)

  const tasksQuery = db?.useQueryX(() => {
    return q({
      tasks: {
        assignee: {},
        workspace: {},
        $: {
          where: {
            'workspace.id': workspaceId,
          },
          order: {
            createdAt: 'desc',
          },
        },
      },
    })
  })

  const allTasks = computed<Task[]>(() => tasksQuery?.tasks.value ?? [])

  const visibleTasks = computed(() => {
    if (statusFilter.value === 'done')
      return allTasks.value.filter(task => task.isDone)

    if (statusFilter.value === 'pending')
      return allTasks.value.filter(task => !task.isDone)

    return allTasks.value
  })

  const pendingCount = computed(() => {
    return allTasks.value.filter(task => !task.isDone).length
  })

  const doneCount = computed(() => {
    return allTasks.value.length - pendingCount.value
  })

  const queryError = computed(() => tasksQuery?.error.value?.message ?? '')
  const canEdit = computed(() => Boolean(db && auth?.user.value?.id))

  const statusText = computed(() => {
    if (!db)
      return 'Database not configured.'

    if (queryError.value)
      return queryError.value

    if (tasksQuery?.isLoading.value && allTasks.value.length === 0)
      return 'Loading tasks...'

    if (allTasks.value.length === 0)
      return 'No tasks yet. Create your first one.'

    if (visibleTasks.value.length === 0)
      return `No ${statusFilter.value} tasks for the current filter.`

    return `${visibleTasks.value.length} task${visibleTasks.value.length === 1 ? '' : 's'} visible.`
  })

  function clearFeedback() {
    actionError.value = ''
    actionMessage.value = ''
  }

  async function createTask() {
    const title = titleInput.value.trim()
    if (!db || !title || isMutating.value)
      return

    isMutating.value = true
    clearFeedback()

    const taskId = id()

    try {
      await db.transact([
        db.tx.tasks[taskId]!.update({
          title,
          isDone: false,
          createdAt: Date.now(),
        }),
        db.tx.tasks[taskId]!.link({
          workspace: workspaceId,
        }),
      ])

      titleInput.value = ''
    }
    catch (error) {
      actionError.value = formatError(error)
    }
    finally {
      isMutating.value = false
    }
  }

  async function toggleTaskDone(task: Task) {
    if (!db || isMutating.value)
      return

    isMutating.value = true
    clearFeedback()

    try {
      await db.transact(
        db.tx.tasks[task.id]!.update({
          isDone: !task.isDone,
        }),
      )
    }
    catch (error) {
      actionError.value = formatError(error)
    }
    finally {
      isMutating.value = false
    }
  }

  async function toggleTaskAssignee(task: Task) {
    const userId = auth?.user.value?.id
    if (!db || !userId || isMutating.value)
      return

    isMutating.value = true
    clearFeedback()

    try {
      if (task.assignee?.id === userId) {
        await db.transact(
          db.tx.tasks[task.id]!.unlink({
            assignee: userId,
          }),
        )
      }
      else {
        await db.transact(
          db.tx.tasks[task.id]!.link({
            assignee: userId,
          }),
        )
      }
    }
    catch (error) {
      actionError.value = formatError(error)
    }
    finally {
      isMutating.value = false
    }
  }

  async function deleteTask(taskId: string) {
    if (!db || isMutating.value)
      return

    isMutating.value = true
    clearFeedback()

    try {
      await db.transact(
        db.tx.tasks[taskId]!.delete(),
      )
    }
    catch (error) {
      actionError.value = formatError(error)
    }
    finally {
      isMutating.value = false
    }
  }

  async function clearDoneTasks() {
    if (!db || isMutating.value)
      return

    const doneTasks = allTasks.value.filter(task => task.isDone)
    if (doneTasks.length === 0)
      return

    isMutating.value = true
    clearFeedback()

    try {
      await db.transact(
        doneTasks.map(task => db.tx.tasks[task.id]!.delete()),
      )
      actionMessage.value = `Deleted ${doneTasks.length} completed task${doneTasks.length === 1 ? '' : 's'}.`
    }
    catch (error) {
      actionError.value = formatError(error)
    }
    finally {
      isMutating.value = false
    }
  }

  function setStatusFilter(nextStatus: TaskStatusFilter) {
    statusFilter.value = nextStatus
  }

  return reactive({
    statusFilters,
    statusFilter,
    titleInput,

    isLoading: computed(() => Boolean(tasksQuery?.isLoading.value)),
    isMutating,
    queryError,
    actionError,
    actionMessage,
    statusText,

    allTasks,
    visibleTasks,
    pendingCount,
    doneCount,
    canEdit,

    setStatusFilter,
    createTask,
    toggleTaskDone,
    toggleTaskAssignee,
    deleteTask,
    clearDoneTasks,
  })
}
