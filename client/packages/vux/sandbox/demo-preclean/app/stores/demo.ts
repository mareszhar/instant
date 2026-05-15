import type {
  ConnectionStatus,
  InstaQLEntity,
} from '@mszr/idb-vux'
import type { AppSchema } from '../../instant.schema'
import { id } from '@mszr/idb-vux'

type Quest = InstaQLEntity<AppSchema, 'quests', {
  requestor: {}
  assignee: {}
}>
type QuestPoolFilter = 'assigned' | 'requested'
type QuestStatusFilter = 'all' | 'pending' | 'done'

type DemoPresenceKey = 'name' | 'status'

interface ReactionEvent {
  id: string
  emoji: string
  sender: string
}

interface PresencePeer {
  name?: string
  status?: string
}

interface AdminOverview {
  generatedAt: string
  mode: 'live' | 'degraded'
  counts: {
    totalQuests: number
    doneQuests: number
    pendingQuests: number
    userCount: number
  }
  syncedUser: {
    id: string
    email?: string
    isGuest?: boolean
  } | null
  warning: string
}

interface AdminPurgeResult {
  generatedAt: string
  mode: 'live' | 'degraded'
  deletedCount: number
  totalBefore: number
  totalAfter: number
  warning: string
}

const questPoolFilters = ['requested', 'assigned'] as const
const questStatusFilters = ['all', 'pending', 'done'] as const

export const useDemoStore = defineStore('instant-vue-demo', () => {
  const db = useDb()

  const hasDatabase = computed(() => Boolean(db))

  const auth = db?.useAuth()
  const connectionStatus = db
    ? db.useConnectionStatus()
    : readonly(ref<ConnectionStatus>('connecting'))

  const localId = db
    ? db.useLocalId('nuxt-vue-demo-device')
    : readonly(ref<string | null>(null))

  const questPoolFilter = useSessionStorage<QuestPoolFilter>(
    'instant-vue-demo:quest-pool-filter',
    'requested',
  )
  const questStatusFilter = useSessionStorage<QuestStatusFilter>(
    'instant-vue-demo:quest-status-filter',
    'all',
  )

  const questsQuery = db?.useQuery({
    quests: {
      requestor: {},
      assignee: {},
    },
  } as const)

  const hasResolvedQuestsQuery = ref(false)

  watchEffect(() => {
    if (questsQuery && !questsQuery.isLoading.value && !questsQuery.error.value)
      hasResolvedQuestsQuery.value = true
  })

  const allQuests = computed<Quest[]>(() => questsQuery?.data.value?.quests ?? [])

  const isAssignedPoolWithoutUser = computed(() => (
    questPoolFilter.value === 'assigned'
    && !auth?.user.value?.id
  ))

  const activePoolQuests = computed<Quest[]>(() => {
    const userId = auth?.user.value?.id
    if (questPoolFilter.value === 'assigned') {
      if (!userId)
        return []

      return allQuests.value.filter(quest => quest.assignee?.id === userId)
    }

    return allQuests.value
  })

  const filteredQuests = computed<Quest[]>(() => {
    if (questStatusFilter.value === 'pending')
      return activePoolQuests.value.filter(quest => quest.status === 'pending')

    if (questStatusFilter.value === 'done')
      return activePoolQuests.value.filter(quest => quest.status === 'done')

    return activePoolQuests.value
  })

  const pendingQuestCount = computed(() => {
    return activePoolQuests.value.filter(quest => quest.status !== 'done').length
  })

  const canEditQuests = computed(() => Boolean(auth?.user.value))

  const questErrorMessage = computed(() => questsQuery?.error.value?.message ?? '')

  const questStatusText = computed(() => {
    if (!db)
      return 'Database not configured'

    if (questErrorMessage.value)
      return questErrorMessage.value

    if (isAssignedPoolWithoutUser.value)
      return 'Sign in to view quests assigned to you. The requested pool is public.'

    if (
      !hasResolvedQuestsQuery.value
      && (questsQuery?.isLoading.value ?? false)
      && allQuests.value.length === 0
    ) {
      return 'Loading quest board...'
    }

    if (activePoolQuests.value.length === 0) {
      if (questPoolFilter.value === 'assigned')
        return 'No quests are currently assigned to you.'

      return 'No public requested quests yet.'
    }

    if (filteredQuests.value.length === 0) {
      if (questStatusFilter.value === 'pending') {
        return questPoolFilter.value === 'assigned'
          ? 'No pending quests assigned to you.'
          : 'No pending quests in the public requested pool.'
      }

      if (questStatusFilter.value === 'done') {
        return questPoolFilter.value === 'assigned'
          ? 'No completed quests assigned to you.'
          : 'No completed quests in the public requested pool.'
      }
    }

    if (questsQuery?.isLoading.value)
      return '\u00A0'

    return '\u00A0'
  })

  const connectionLabel = computed(() => {
    if (!db)
      return 'uninitialized'

    return toConnectionLabel(connectionStatus.value)
  })

  const presenceStatusLabel = computed(() => {
    return toPresenceConnectionLabel(connectionStatus.value)
  })

  const localIdLabel = computed(() => {
    if (!db)
      return 'uninitialized'

    return localId.value ?? 'loading...'
  })

  const emailAddressInput = ref('')
  const magicCodeInput = ref('')
  const sentCodeEmailAddress = ref('')
  const authErrorMessage = ref('')
  const isAuthenticating = ref(false)

  const signedInLabel = computed(() => {
    const user = auth?.user.value
    if (!user)
      return ''

    if (!user.isGuest && user.email)
      return user.email

    return `Guest-${user.id.slice(-6)}`
  })

  const signedInUserId = computed(() => auth?.user.value?.id ?? '')

  const room = db?.room('demo', 'main') ?? null

  const recentReactions = ref<ReactionEvent[]>([])
  const pingEventsReceived = ref(0)
  const topicEventTotal = computed(
    () => recentReactions.value.length + pingEventsReceived.value,
  )

  const presencePayload = reactive({
    name: 'Anonymous',
    status: 'authenticating',
  })

  watchEffect(() => {
    presencePayload.name = signedInLabel.value || 'Anonymous'
    presencePayload.status = presenceStatusLabel.value
  })

  if (db && room) {
    db.rooms.useSyncPresence(room, presencePayload)
  }

  const presence = room
    ? db?.rooms.usePresence(room, {
        keys: ['name', 'status'] as DemoPresenceKey[],
      })
    : null

  const presencePeers = computed(() => {
    return Object.entries((presence?.peers ?? {}) as Record<string, PresencePeer>)
  })

  const publishReaction = room ? db?.rooms.usePublishTopic(room, 'reaction') : null
  const publishPing = room ? db?.rooms.usePublishTopic(room, 'ping') : null

  if (db && room) {
    db.rooms.useTopicEffect(room, 'reaction', (event, peer) => {
      recentReactions.value.unshift({
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        emoji: event.emoji,
        sender: peer?.name ?? 'Anonymous',
      })

      if (recentReactions.value.length > 8) {
        recentReactions.value = recentReactions.value.slice(0, 8)
      }
    })

    db.rooms.useTopicEffect(room, 'ping', () => {
      pingEventsReceived.value += 1
    })
  }

  const typing = room
    ? db?.rooms.useTypingIndicator(room, 'chat', {
        stopOnEnter: true,
      })
    : null

  const pendingQuestTitle = ref('')

  const typingDraftMessage = ref('')
  const typingIndicatorText = computed(() => {
    const activePeers = typing?.active ?? []

    if (activePeers.length === 0)
      return ''

    if (activePeers.length === 1)
      return `${activePeers[0]?.name ?? 'Someone'} is typing...`

    if (activePeers.length === 2)
      return `${activePeers[0]?.name ?? 'Someone'} and ${activePeers[1]?.name ?? 'someone'} are typing...`

    return `${activePeers[0]?.name ?? 'Someone'} and ${activePeers.length - 1} others are typing...`
  })

  const adminOverview = ref<AdminOverview | null>(null)
  const isLoadingAdminOverview = ref(false)
  const isPurgingCompleted = ref(false)
  const adminErrorMessage = ref('')
  const adminActionMessage = ref('')

  function setQuestPoolFilter(nextFilter: QuestPoolFilter) {
    questPoolFilter.value = nextFilter
  }

  function setQuestStatusFilter(nextFilter: QuestStatusFilter) {
    questStatusFilter.value = nextFilter
  }

  function createQuest() {
    if (!db || !canEditQuests.value || !pendingQuestTitle.value.trim())
      return

    const questId = id()
    const chunks = [
      db.tx.quests[questId]!.update({
        title: pendingQuestTitle.value.trim(),
        status: 'pending',
        createdAt: Date.now(),
      }),
    ]

    if (auth?.user.value?.id) {
      chunks.push(
        db.tx.quests[questId]!.link({
          requestor: auth.user.value.id,
        }),
      )
    }

    db.transact(chunks)

    pendingQuestTitle.value = ''
  }

  function toggleQuestCompletion(quest: Quest) {
    if (!db || !canEditQuests.value)
      return

    const nextStatus = quest.status === 'done' ? 'pending' : 'done'
    db.transact(db.tx.quests[quest.id]!.update({ status: nextStatus }))
  }

  function toggleQuestAssignment(quest: Quest) {
    if (!db || !canEditQuests.value || !auth?.user.value?.id)
      return

    if (quest.assignee?.id === auth.user.value.id) {
      db.transact(
        db.tx.quests[quest.id]!.unlink({
          assignee: auth.user.value.id,
        }),
      )
      return
    }

    db.transact(
      db.tx.quests[quest.id]!.link({
        assignee: auth.user.value.id,
      }),
    )
  }

  function removeQuest(quest: Quest) {
    if (!db || !canEditQuests.value)
      return

    db.transact(db.tx.quests[quest.id]!.delete())
  }

  function clearCompletedQuests() {
    const userId = auth?.user.value?.id
    if (!db || !canEditQuests.value || !userId)
      return

    const removableQuests = activePoolQuests.value.filter(quest => (
      quest.status === 'done'
      && quest.requestor?.id === userId
    ))

    if (removableQuests.length === 0)
      return

    db.transact(removableQuests.map(quest => db.tx.quests[quest.id]!.delete()))
  }

  async function signInAsGuest() {
    if (!db)
      return

    isAuthenticating.value = true
    authErrorMessage.value = ''

    try {
      await db.auth.signInAsGuest()
    }
    catch (error) {
      authErrorMessage.value = formatAuthError(error)
    }
    finally {
      isAuthenticating.value = false
    }
  }

  async function requestMagicCode() {
    if (!db || !emailAddressInput.value.trim())
      return

    isAuthenticating.value = true
    authErrorMessage.value = ''

    try {
      await db.auth.sendMagicCode({ email: emailAddressInput.value.trim() })
      sentCodeEmailAddress.value = emailAddressInput.value.trim()
      magicCodeInput.value = ''
    }
    catch (error) {
      authErrorMessage.value = formatAuthError(error)
    }
    finally {
      isAuthenticating.value = false
    }
  }

  async function confirmMagicCode() {
    if (!db || !sentCodeEmailAddress.value || !magicCodeInput.value.trim())
      return

    isAuthenticating.value = true
    authErrorMessage.value = ''

    try {
      await db.auth.signInWithMagicCode({
        email: sentCodeEmailAddress.value,
        code: magicCodeInput.value.trim(),
      })
      magicCodeInput.value = ''
    }
    catch (error) {
      authErrorMessage.value = formatAuthError(error)
    }
    finally {
      isAuthenticating.value = false
    }
  }

  function resetMagicCodeFlow() {
    sentCodeEmailAddress.value = ''
    magicCodeInput.value = ''
    authErrorMessage.value = ''
  }

  async function signOut() {
    if (!db)
      return

    await db.auth.signOut()
  }

  function sendReaction(emoji: string) {
    publishReaction?.({ emoji })
  }

  function sendPing() {
    publishPing?.({ message: `ping-${Date.now()}` })
  }

  function handleTypingKeydown(event: KeyboardEvent) {
    typing?.inputProps.onKeyDown(event)

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()

      if (typingDraftMessage.value.trim()) {
        sendPing()
        typingDraftMessage.value = ''
      }
    }
  }

  function handleTypingBlur() {
    typing?.inputProps.onBlur()
  }

  async function loadAdminOverview() {
    if (!db)
      return

    isLoadingAdminOverview.value = true
    adminErrorMessage.value = ''
    adminActionMessage.value = ''

    try {
      const overview = await $fetch<AdminOverview>('/api/admin/overview')
      adminOverview.value = overview

      if (overview.mode === 'degraded' && overview.warning) {
        adminActionMessage.value = overview.warning
      }
    }
    catch (error) {
      adminErrorMessage.value = formatAuthError(error)
    }
    finally {
      isLoadingAdminOverview.value = false
    }
  }

  async function purgeCompletedQuestsWithAdmin() {
    if (!db)
      return

    isPurgingCompleted.value = true
    adminErrorMessage.value = ''
    adminActionMessage.value = ''

    try {
      const result = await $fetch<AdminPurgeResult>('/api/admin/purge-completed', {
        method: 'POST',
      })

      if (result.mode === 'degraded' && result.warning) {
        adminErrorMessage.value = result.warning
      }
      else {
        adminActionMessage.value = `Purged ${result.deletedCount} completed quest${result.deletedCount === 1 ? '' : 's'} on server.`
      }

      await loadAdminOverview()
    }
    catch (error) {
      adminErrorMessage.value = formatAuthError(error)
    }
    finally {
      isPurgingCompleted.value = false
    }
  }

  return {
    hasDatabase,

    signedInLabel,
    signedInUserId,

    connectionLabel,
    presenceStatusLabel,
    localIdLabel,

    questPoolFilters,
    questStatusFilters,
    questPoolFilter,
    questStatusFilter,
    setQuestPoolFilter,
    setQuestStatusFilter,
    pendingQuestTitle,
    allQuests,
    activePoolQuests,
    filteredQuests,
    pendingQuestCount,
    canEditQuests,
    questErrorMessage,
    questStatusText,
    createQuest,
    toggleQuestCompletion,
    toggleQuestAssignment,
    removeQuest,
    clearCompletedQuests,

    emailAddressInput,
    magicCodeInput,
    sentCodeEmailAddress,
    authErrorMessage,
    isAuthenticating,
    signInAsGuest,
    requestMagicCode,
    confirmMagicCode,
    resetMagicCodeFlow,
    signOut,

    presencePeers,
    topicEventTotal,
    recentReactions,
    sendReaction,
    sendPing,

    typingDraftMessage,
    typingIndicatorText,
    handleTypingKeydown,
    handleTypingBlur,

    adminOverview,
    isLoadingAdminOverview,
    isPurgingCompleted,
    adminErrorMessage,
    adminActionMessage,
    loadAdminOverview,
    purgeCompletedQuestsWithAdmin,
  }
})

function formatAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Unexpected error'
  }

  const maybeError = error as { body?: { message?: string }, message?: string }
  return maybeError.body?.message ?? maybeError.message ?? 'Unexpected error'
}

function toConnectionLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'authenticated':
      return 'connected'
    case 'connecting':
    case 'opened':
      return 'authenticating'
    case 'closed':
      return 'disconnected'
    case 'errored':
      return 'error'
    default:
      return status
  }
}

function toPresenceConnectionLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'authenticated':
      return 'connected'
    case 'connecting':
    case 'opened':
      return 'authenticating'
    case 'closed':
    case 'errored':
      return 'disconnected'
    default:
      return 'authenticating'
  }
}
