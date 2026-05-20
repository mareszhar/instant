export const useWorkspaces = defineStore('workspaces', () => {
  const { db, auth } = useIdb()

  const form = reactive({
    name: '',
    inviteCode: '',
    isProcessing: false,
    feedback: null as Feedback | null,
  })

  const { isLoading, error, workspaces: available } = db.useQueryX(() => q({
    workspaces: {
      $: {
        where: { 'memberships.user': auth.user?.id ?? $skip },
        order: { createdAt: 'desc' },
      },
      memberships: {},
    },
  }))

  const inviteCodeOfOpen = useStoreSessionStorage('invite-code-of-open-workspace', '')
  const open = (inviteCode: string) => inviteCodeOfOpen.value = inviteCode
  const current = computed(() => {
    return !inviteCodeOfOpen.value
      ? null
      : available.value.find(workspace => workspace.inviteCode === inviteCodeOfOpen.value) ?? null
  })

  watch(available, () => {
    if (!isLoading.value && !current.value)
      inviteCodeOfOpen.value = available.value[0]?.inviteCode ?? ''
  })

  const wireMembership = (inviteCode: string) => db.transact(
    db.tx.memberships[id()]!
      .ruleParams({ inviteCode })
      .create({ createdAt: Date.now() })
      .link({ user: auth.user!.id, workspace: lookup('inviteCode', inviteCode) }),
  )

  const create = () => executeFormAction(form, !auth.user?.id || !form.name, async () => {
    const inviteCode = id().slice(-12)

    await db.transact(db.tx.workspaces[id()]!.create({ name: form.name, inviteCode, createdAt: Date.now() }))
    await wireMembership(inviteCode)

    form.name = ''
    open(inviteCode)
    return `Workspace created. Invite code: ${inviteCode}`
  })

  const join = () => executeFormAction(form, !auth.user?.id || !form.inviteCode, async () => {
    const inviteCode = form.inviteCode
    const alreadyJoined = available.value.find(workspace => workspace.inviteCode === inviteCode)

    if (!alreadyJoined)
      await wireMembership(inviteCode)

    form.inviteCode = ''
    open(inviteCode)
    return alreadyJoined ? `Switched to ${alreadyJoined.name}` : `Joined with invite code ${inviteCode}`
  })

  const remove = (workspaceId: string) => executeFormAction(form, false, async () => {
    await db.transact(db.tx.workspaces[workspaceId]!.delete())
    return 'Workspace deleted'
  })

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
    isLoading,
    error,
    available,
    inviteCodeOfOpen,
    open,
    current,
    create,
    join,
    remove,
    copyingFeedback,
    copyInviteCode,
  }
})
