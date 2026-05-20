import type { ConnectionStatus, InstantVuxDatabase, InstaQLEntity } from '@mszr/idb-vux'

const WORKSPACE_STORAGE_KEY = 'idb-vux-demo:active-workspace-id'

type Workspace = InstaQLEntity<AppSchema, 'workspaces', {
  owner: {}
  memberships: {
    user: {}
  }
}>

function resolveConnectionStatus(
  db: InstantVuxDatabase<AppSchema> | null,
): Readonly<Ref<ConnectionStatus>> {
  return db
    ? db.useConnectionStatus()
    : readonly(ref<ConnectionStatus>('connecting'))
}

function resolveLocalId(
  db: InstantVuxDatabase<AppSchema> | null,
): Readonly<Ref<string | null>> {
  return db
    ? db.useLocalId('idb-vux-demo-device')
    : readonly(ref<string | null>(null))
}

function useAccessInternal() {
  const db = useDb()
  const auth = db?.useAuth()

  const hasDatabase = computed(() => Boolean(db))
  const user = computed(() => auth?.user.value ?? null)

  const connectionStatus = resolveConnectionStatus(db)
  const localId = resolveLocalId(db)

  const appId = useRuntimeConfig().public.instantAppId ?? ''
  const connectionLabel = computed(() => {
    if (!db)
      return 'uninitialized'

    return toConnectionLabel(connectionStatus.value)
  })

  const localIdLabel = computed(() => {
    if (!db)
      return 'uninitialized'

    return localId.value ?? 'loading...'
  })

  const isSignedIn = computed(() => Boolean(user.value))
  const signedInUserId = computed(() => user.value?.id ?? '')
  const signedInLabel = computed(() => {
    const currentUser = user.value
    if (!currentUser)
      return ''

    if (!currentUser.isGuest && currentUser.email)
      return currentUser.email

    return `Guest-${currentUser.id.slice(-6)}`
  })

  const emailAddress = ref('')
  const magicCode = ref('')
  const sentCodeEmailAddress = ref('')
  const authError = ref('')
  const isAuthenticating = ref(false)

  const workspaceName = ref('')
  const inviteCode = ref('')
  const accessMessage = ref('')
  const accessError = ref('')
  const isSavingWorkspace = ref(false)
  const isDeletingWorkspace = ref(false)

  const workspacesQuery = db?.useQueryX(() => {
    if (!user.value?.id) {
      return null
    }

    return q({
      workspaces: {
        owner: {},
        memberships: {
          user: {},
        },
        $: {
          order: {
            createdAt: 'desc',
          },
        },
      },
    })
  })

  const workspaces = computed<Workspace[]>(() => {
    return workspacesQuery?.workspaces.value ?? []
  })

  const workspaceQueryError = computed(() => {
    return workspacesQuery?.error.value?.message ?? ''
  })

  const activeWorkspaceIdState = useSessionStorage<string | null>(
    WORKSPACE_STORAGE_KEY,
    null,
  )

  watch(workspaces, (items) => {
    if (items.length === 0) {
      activeWorkspaceIdState.value = null
      return
    }

    if (
      activeWorkspaceIdState.value
      && items.some(workspace => workspace.id === activeWorkspaceIdState.value)
    ) {
      return
    }

    activeWorkspaceIdState.value = items[0]!.id
  }, { immediate: true })

  const activeWorkspace = computed<Workspace | null>(() => {
    if (!activeWorkspaceIdState.value)
      return null

    return (
      workspaces.value.find(workspace => workspace.id === activeWorkspaceIdState.value)
      ?? null
    )
  })

  const activeWorkspaceId = computed(() => activeWorkspace.value?.id ?? null)
  const workspaceStatusText = computed(() => {
    if (!db)
      return 'Database not configured.'

    if (!user.value?.id)
      return 'Sign in to create or join a workspace.'

    if (workspaceQueryError.value)
      return workspaceQueryError.value

    if (workspacesQuery?.isLoading.value)
      return 'Loading workspaces...'

    if (workspaces.value.length === 0)
      return 'No workspaces yet. Create one or join with an invite code.'

    return `${workspaces.value.length} workspace${workspaces.value.length === 1 ? '' : 's'} available.`
  })

  const canCreateWorkspace = computed(() => {
    return Boolean(db && user.value?.id && workspaceName.value.trim())
  })

  const canJoinWorkspace = computed(() => {
    return Boolean(db && user.value?.id && inviteCode.value.trim())
  })

  function clearAccessFeedback() {
    accessError.value = ''
    accessMessage.value = ''
  }

  async function createUniqueInviteCode(): Promise<string> {
    if (!db)
      return createInviteCode()

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = createInviteCode()
      const existing = await db.queryOnceX(q({
        workspaces: {
          $: {
            where: {
              inviteCode: candidate,
            },
            limit: 1,
          },
        },
      }))

      if (existing.workspaces.length === 0)
        return candidate
    }

    throw new Error('Could not generate a unique invite code. Please try again.')
  }

  function selectWorkspace(workspaceId: string) {
    activeWorkspaceIdState.value = workspaceId
  }

  async function signInAsGuest() {
    if (!db || isAuthenticating.value)
      return

    isAuthenticating.value = true
    authError.value = ''

    try {
      await db.auth.signInAsGuest()
    }
    catch (error) {
      authError.value = formatError(error)
    }
    finally {
      isAuthenticating.value = false
    }
  }

  async function requestMagicCode() {
    if (!db || !emailAddress.value.trim() || isAuthenticating.value)
      return

    isAuthenticating.value = true
    authError.value = ''

    try {
      const trimmedEmail = emailAddress.value.trim()
      await db.auth.sendMagicCode({ email: trimmedEmail })
      sentCodeEmailAddress.value = trimmedEmail
      magicCode.value = ''
    }
    catch (error) {
      authError.value = formatError(error)
    }
    finally {
      isAuthenticating.value = false
    }
  }

  async function confirmMagicCode() {
    if (
      !db
      || !sentCodeEmailAddress.value
      || !magicCode.value.trim()
      || isAuthenticating.value
    ) {
      return
    }

    isAuthenticating.value = true
    authError.value = ''

    try {
      await db.auth.signInWithMagicCode({
        email: sentCodeEmailAddress.value,
        code: magicCode.value.trim(),
      })
      magicCode.value = ''
    }
    catch (error) {
      authError.value = formatError(error)
    }
    finally {
      isAuthenticating.value = false
    }
  }

  function resetMagicCodeFlow() {
    sentCodeEmailAddress.value = ''
    magicCode.value = ''
    authError.value = ''
  }

  async function signOut() {
    if (!db)
      return

    await db.auth.signOut()
  }

  async function createWorkspace() {
    const currentUserId = user.value?.id
    const nextName = workspaceName.value.trim()

    if (!db || !currentUserId || !nextName || isSavingWorkspace.value)
      return

    isSavingWorkspace.value = true
    clearAccessFeedback()

    const workspaceId = id()
    const membershipId = id()
    let nextInviteCode = ''

    try {
      nextInviteCode = await createUniqueInviteCode()

      await db.transact([
        db.tx.workspaces[workspaceId]!.update({
          name: nextName,
          inviteCode: nextInviteCode,
          createdAt: Date.now(),
        }),
        db.tx.workspaces[workspaceId]!.link({
          owner: currentUserId,
        }),
        db.tx.memberships[membershipId]!.update({
          createdAt: Date.now(),
        }),
        db.tx.memberships[membershipId]!.ruleParams({
          inviteCode: nextInviteCode,
        }),
        db.tx.memberships[membershipId]!.link({
          user: currentUserId,
        }),
        db.tx.memberships[membershipId]!.link({
          workspace: workspaceId,
        }),
      ])

      workspaceName.value = ''
      inviteCode.value = ''
      activeWorkspaceIdState.value = workspaceId
      accessMessage.value = `Workspace created. Invite code: ${nextInviteCode}`
    }
    catch (error) {
      accessError.value = formatError(error)
    }
    finally {
      isSavingWorkspace.value = false
    }
  }

  async function joinWorkspaceWithInviteCode() {
    const currentUserId = user.value?.id
    const normalizedInviteCode = inviteCode.value.trim().toUpperCase()

    if (!db || !currentUserId || !normalizedInviteCode || isSavingWorkspace.value)
      return

    const alreadyJoined = workspaces.value.find(
      workspace => workspace.inviteCode === normalizedInviteCode,
    )

    clearAccessFeedback()

    if (alreadyJoined) {
      activeWorkspaceIdState.value = alreadyJoined.id
      inviteCode.value = ''
      accessMessage.value = `Switched to ${alreadyJoined.name}.`
      return
    }

    isSavingWorkspace.value = true

    const membershipId = id()

    try {
      await db.transact([
        db.tx.memberships[membershipId]!.ruleParams({
          inviteCode: normalizedInviteCode,
        }),
        db.tx.memberships[membershipId]!.update({
          createdAt: Date.now(),
        }),
        db.tx.memberships[membershipId]!.link({
          user: currentUserId,
        }),
        db.tx.memberships[membershipId]!.link({
          workspace: lookup('inviteCode', normalizedInviteCode),
        }),
      ])

      inviteCode.value = ''
      accessMessage.value = `Joined with invite code ${normalizedInviteCode}.`
    }
    catch (error) {
      accessError.value = formatError(error)
    }
    finally {
      isSavingWorkspace.value = false
    }
  }

  async function deleteWorkspace(workspaceId: string) {
    if (!db || isDeletingWorkspace.value)
      return

    isDeletingWorkspace.value = true
    clearAccessFeedback()

    try {
      await db.transact(
        db.tx.workspaces[workspaceId]!.delete(),
      )
      accessMessage.value = 'Workspace deleted.'
    }
    catch (error) {
      accessError.value = formatError(error)
    }
    finally {
      isDeletingWorkspace.value = false
    }
  }

  const proxySafeDb = db ? markRaw(db) : null

  return reactive({
    db,
    proxySafeDb,

    appId,
    hasDatabase,
    connectionLabel,
    localIdLabel,

    auth,
    user,
    isSignedIn,
    signedInUserId,
    signedInLabel,

    emailAddress,
    magicCode,
    sentCodeEmailAddress,
    authError,
    isAuthenticating,
    signInAsGuest,
    requestMagicCode,
    confirmMagicCode,
    resetMagicCodeFlow,
    signOut,

    workspaceName,
    inviteCode,
    accessMessage,
    accessError,
    workspaceStatusText,
    workspaces,
    activeWorkspaceId,
    canCreateWorkspace,
    canJoinWorkspace,
    isSavingWorkspace,
    isDeletingWorkspace,
    selectWorkspace,
    createWorkspace,
    joinWorkspaceWithInviteCode,
    deleteWorkspace,
  })
}

export const useAccessComp = createSharedComposable(useAccessInternal)
