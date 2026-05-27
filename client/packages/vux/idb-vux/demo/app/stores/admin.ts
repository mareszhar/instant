export const admin = defineStore('admin', async () => {
  const workspaces = useWorkspaces()
  const tasks = useTasks()

  const form = reactive({
    isProcessing: false,
    feedback: useEphemeralFeedback(),
  })

  const workspaceSummary = ref<InternalApi['/api/workspaces/:id/summary']['get'] | null>(null)

  const refreshWorkspaceSummary = () => executeFormAction(form, !workspaces.current?.id, async () => {
    const newSummary = await $fetch(`/api/workspaces/${workspaces.current!.id}/summary`)
    workspaceSummary.value = newSummary
    if (newSummary.warning)
      throw new Error(newSummary.warning)
  })

  const removeDoneTasks = () => executeFormAction(form, !tasks.byStatus.done.length, async () => {
  })

  return {
    form,
    workspaceSummary,
    refreshWorkspaceSummary,
    removeDoneTasks,
  }
})
