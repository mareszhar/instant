export const useWorkspacesStore = defineStore('workspaces', () => {
  const access = useAccessStore()
  const db = useDb()

  const form = reactive({
    name: '',
    inviteCode: '',
    isProcessing: false,
    feedback: null as Feedback | null,
  })

  const { isLoading: queryIsLoading, error: queryError, workspaces: availableWorkspaces } = db.useQueryX(() => q({
    workspaces: {
      $: {
        where: { 'memberships.user.id': access.auth.user?.id ?? $skip },
        order: { createdAt: 'desc' },
      },
      memberships: {},
    },
  }))

  const requestedInviteCode = useSessionStorage('requested-workspace-invite-code', '')
  const requestWorkspace = (inviteCode: string) => requestedInviteCode.value = inviteCode
  const current = computed(() => {
    return !requestedInviteCode.value
      ? null
      : availableWorkspaces.value.find(workspace => workspace.inviteCode === requestedInviteCode.value) ?? null
  })

  function startProcessingForm() {
    form.isProcessing = true
    form.feedback = null
  }

  async function createWorkspace() {
    if (!access.auth.user?.id || !form.name || form.isProcessing)
      return

    startProcessingForm()
    const newWorkspaceId = id()
    const newMembershipId = id()
    const newWorkspaceInviteCode = id().slice(-12)

    const [errorCreatingWorkspace] = await go(db.transact([
      db.tx.workspaces[newWorkspaceId]!.create({
        name: form.name,
        inviteCode: newWorkspaceInviteCode,
        createdAt: Date.now(),
      }),
      db.tx.memberships[newMembershipId]!
        .ruleParams({ inviteCode: newWorkspaceInviteCode })
        .create({ createdAt: Date.now() })
        .link({ user: access.auth.user.id, workspace: newWorkspaceId }),
    ]))

    if (errorCreatingWorkspace) {
      form.feedback = { tone: 'danger', text: formatError(errorCreatingWorkspace) }
    }
    else {
      form.name = ''
      requestedInviteCode.value = newWorkspaceId
      form.feedback = { tone: 'success', text: `Workspace created. Invite code: ${newWorkspaceInviteCode}` }
    }

    form.isProcessing = false
  }

  async function joinWorkspace() {
    if (!access.auth.user?.id || !form.inviteCode || form.isProcessing)
      return

    startProcessingForm()
    const alreadyJoined = availableWorkspaces.value.find(workspace => workspace.inviteCode === form.inviteCode)
    let errorJoiningWorkspace: Error | undefined

    if (!alreadyJoined) {
      const newMembershipId = id()
        ;[errorJoiningWorkspace] = await go(db.transact(
        db.tx.memberships[newMembershipId]!
          .ruleParams({ inviteCode: form.inviteCode })
          .create({ createdAt: Date.now() })
          .link({ user: access.auth.user.id, workspace: lookup('inviteCode', form.inviteCode) }),
      ))
    }

    if (errorJoiningWorkspace) {
      form.feedback = { tone: 'danger', text: formatError(errorJoiningWorkspace) }
    }
    else {
      requestedInviteCode.value = form.inviteCode
      form.feedback = { tone: 'success', text: alreadyJoined ? `Switched to ${alreadyJoined.name}` : `Joined with invite code ${form.inviteCode}` }
      form.inviteCode = ''
    }

    form.isProcessing = false
  }

  async function deleteWorkspace(workspaceId: string) {
    if (form.isProcessing)
      return

    startProcessingForm()
    const [errorDeletingWorkspace] = await go(db.transact(
      db.tx.workspaces[workspaceId]!.delete(),
    ))
    if (errorDeletingWorkspace)
      form.feedback = { tone: 'danger', text: formatError(errorDeletingWorkspace) }
    else
      form.feedback = { tone: 'success', text: 'Workspace deleted' }

    form.isProcessing = false
  }

  const copyingFeedback = ref<Feedback | null>(null)
  const { copy } = useClipboard()

  async function copyInviteCode(inviteCode: string) {
    const [errorCopying] = await go(copy(inviteCode))
    if (errorCopying)
      copyingFeedback.value = { tone: 'danger', text: 'Copy failed. Please copy manually.' }
    else
      copyingFeedback.value = { tone: 'success', text: `Invite code ${inviteCode} copied!` }
  }

  return {
    form,
    queryIsLoading,
    queryError,
    availableWorkspaces,
    requestedInviteCode,
    requestWorkspace,
    current,
    createWorkspace,
    joinWorkspace,
    deleteWorkspace,
    copyingFeedback,
    copyInviteCode,
  }
})
