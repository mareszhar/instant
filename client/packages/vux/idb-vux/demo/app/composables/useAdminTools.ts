interface AdminSummary {
  generatedAt: string
  mode: 'live' | 'degraded'
  counts: {
    totalTasks: number
    doneTasks: number
    pendingTasks: number
    memberCount: number
  }
  syncedUser: {
    id: string
    email?: string
    isGuest: boolean
  } | null
  warning: string
}

interface ClearDoneResult {
  generatedAt: string
  mode: 'live' | 'degraded'
  deletedCount: number
  warning: string
}

export function useAdminTools(workspaceId: string) {
  const summary = ref<AdminSummary | null>(null)
  const isLoadingSummary = ref(false)
  const isClearingDone = ref(false)
  const errorMessage = ref('')
  const actionMessage = ref('')
  useEphemeralText(actionMessage)

  async function refreshSummary() {
    isLoadingSummary.value = true
    errorMessage.value = ''

    try {
      const nextSummary = await $fetch<AdminSummary>('/api/admin/summary', {
        query: {
          workspaceId,
        },
      })

      summary.value = nextSummary

      if (nextSummary.mode === 'degraded' && nextSummary.warning)
        actionMessage.value = nextSummary.warning
    }
    catch (error) {
      errorMessage.value = formatError(error)
    }
    finally {
      isLoadingSummary.value = false
    }
  }

  async function clearDoneWithAdmin() {
    isClearingDone.value = true
    errorMessage.value = ''
    actionMessage.value = ''

    try {
      const result = await $fetch<ClearDoneResult>('/api/admin/clear-done', {
        method: 'POST',
        body: {
          workspaceId,
        },
      })

      if (result.mode === 'degraded' && result.warning) {
        errorMessage.value = result.warning
      }
      else {
        actionMessage.value = `Server deleted ${result.deletedCount} completed task${result.deletedCount === 1 ? '' : 's'}.`
      }

      await refreshSummary()
    }
    catch (error) {
      errorMessage.value = formatError(error)
    }
    finally {
      isClearingDone.value = false
    }
  }

  return reactive({
    summary,
    isLoadingSummary,
    isClearingDone,
    errorMessage,
    actionMessage,
    refreshSummary,
    clearDoneWithAdmin,
  })
}
