export const admin = defineStore('admin', async () => {
  const workspaces = useWorkspaces()

  const form = reactive({
    isProcessing: false,
    feedback: useEphemeralFeedback(),
  })

  const workspaceSummary = ref<InternalApi['/api/workspaces/:workspaceId/summary']['get'] | null>(null)

  const refreshWorkspaceSummary = () => executeFormAction(form, !workspaces.current?.id, async () => {
    const newSummary = await $fetch(`/api/workspaces/${workspaces.current!.id}/summary`)
    workspaceSummary.value = newSummary
    if (newSummary.warning)
      throw new Error(newSummary.warning)
  })

  const removeDoneTasks = () => executeFormAction(form, !workspaces.current?.id, async () => {
    const response = await $fetch(`/api/workspaces/${workspaces.current!.id}/tasks/done`, { method: 'DELETE' })

    // workspaceSummary.value?.generatedAt = response.generatedAt
    // workspaceSummary.value?.warning = response.generatedAt

    if (response.warning)
      throw new Error(response.warning)

    return `Server deleted ${response.countOfTasksDoneDeleted} completed task${response.countOfTasksDoneDeleted === 1 ? '' : 's'}.`
  })

  return {
    form,
    workspaceSummary,
    refreshWorkspaceSummary,
    removeDoneTasks,
  }
})
