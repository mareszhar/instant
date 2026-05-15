type FeedStatusFilter = 'all' | 'pending' | 'done'

const statusFilters: FeedStatusFilter[] = ['all', 'pending', 'done']
const pageSizes: Array<3 | 5 | 10> = [3, 5, 10]

type FeedTask = InstaQLEntity<AppSchema, 'tasks', {
  assignee: {}
}>

export function useInfiniteTasks(workspaceId: string) {
  const db = useDb()
  const auth = db?.useAuth()

  const statusFilter = useSessionStorage<FeedStatusFilter>(
    'idb-vux-demo:feed:status-filter',
    'all',
  )
  const pageSize = useSessionStorage<(typeof pageSizes)[number]>(
    'idb-vux-demo:feed:page-size',
    5,
  )

  const isSeeding = ref(false)
  const isClearing = ref(false)
  const isMutating = ref(false)
  const actionMessage = ref('')
  const actionError = ref('')
  useEphemeralText(actionMessage)

  const infiniteQuery = db?.useInfiniteQueryX(() => {
    const where = statusFilter.value === 'all'
      ? {
          'workspace.id': workspaceId,
        }
      : {
          'workspace.id': workspaceId,
          'isDone': statusFilter.value === 'done',
        }

    return q({
      tasks: {
        assignee: {},
        $: {
          where,
          order: {
            createdAt: 'desc',
          },
          limit: pageSize.value,
        },
      },
    })
  })

  const visibleTasks = computed<FeedTask[]>(() => infiniteQuery?.tasks.value ?? [])
  const canLoadNextPage = computed(() => Boolean(infiniteQuery?.canLoadNextPage.value))
  const isLoading = computed(() => Boolean(infiniteQuery?.isLoading.value))
  const queryError = computed(() => infiniteQuery?.error.value?.message ?? '')
  const currentUserId = computed(() => auth?.user.value?.id ?? '')

  const statusText = computed(() => {
    if (!db)
      return 'Database not configured.'

    if (queryError.value)
      return queryError.value

    if (isLoading.value && visibleTasks.value.length === 0)
      return 'Loading current query window...'

    if (visibleTasks.value.length === 0)
      return 'No tasks for this filter yet. Seed sample tasks to test pagination.'

    if (canLoadNextPage.value)
      return 'More pages available. Load the next page to extend the list.'

    return 'End of list reached for the current filter.'
  })

  const canSeed = computed(() => Boolean(db && auth?.user.value?.id && !isSeeding.value))
  const canClear = computed(() => Boolean(db && !isClearing.value))
  const canEdit = computed(() => Boolean(db && auth?.user.value?.id))

  function clearFeedback() {
    actionError.value = ''
    actionMessage.value = ''
  }

  function loadNextPage() {
    infiniteQuery?.loadNextPage()
  }

  async function toggleTaskDone(task: FeedTask) {
    if (!db || isMutating.value || isSeeding.value || isClearing.value)
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

  async function toggleTaskAssignee(task: FeedTask) {
    const userId = auth?.user.value?.id
    if (!db || !userId || isMutating.value || isSeeding.value || isClearing.value)
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
    if (!db || isMutating.value || isSeeding.value || isClearing.value)
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

  async function seedSampleTasks() {
    const userId = auth?.user.value?.id
    if (!db || !userId || isSeeding.value)
      return

    isSeeding.value = true
    clearFeedback()

    try {
      const chunks = []
      const baseNow = Date.now()

      for (let index = 0; index < 12; index += 1) {
        const taskId = id()
        const isDone = index % 3 === 0

        chunks.push(
          db.tx.tasks[taskId]!.update({
            title: `Sample task ${String(index + 1).padStart(2, '0')}`,
            isDone,
            createdAt: baseNow + index,
          }),
        )

        chunks.push(
          db.tx.tasks[taskId]!.link({
            workspace: workspaceId,
          }),
        )

        if (index % 2 === 0) {
          chunks.push(
            db.tx.tasks[taskId]!.link({
              assignee: userId,
            }),
          )
        }
      }

      await db.transact(chunks)
      actionMessage.value = 'Seeded 12 sample tasks.'
    }
    catch (error) {
      actionError.value = formatError(error)
    }
    finally {
      isSeeding.value = false
    }
  }

  async function clearSeededTasks() {
    if (!db || isClearing.value)
      return

    isClearing.value = true
    clearFeedback()

    try {
      const response = await db.queryOnceX(q({
        tasks: {
          $: {
            where: {
              'workspace.id': workspaceId,
              'title': {
                $like: 'Sample task %',
              },
            },
            limit: 500,
          },
        },
      }))

      const seededTasks = response.tasks
      if (seededTasks.length === 0) {
        actionMessage.value = 'No seeded sample tasks found.'
        return
      }

      await db.transact(
        seededTasks.map(task => db.tx.tasks[task.id]!.delete()),
      )

      actionMessage.value = `Deleted ${seededTasks.length} seeded task${seededTasks.length === 1 ? '' : 's'}.`
    }
    catch (error) {
      actionError.value = formatError(error)
    }
    finally {
      isClearing.value = false
    }
  }

  return reactive({
    statusFilters,
    pageSizes,
    statusFilter,
    pageSize,

    visibleTasks,
    currentUserId,
    isLoading,
    isMutating,
    canLoadNextPage,
    statusText,
    queryError,

    isSeeding,
    isClearing,
    canSeed,
    canClear,
    canEdit,
    actionError,
    actionMessage,

    loadNextPage,
    toggleTaskDone,
    toggleTaskAssignee,
    deleteTask,
    seedSampleTasks,
    clearSeededTasks,
  })
}
