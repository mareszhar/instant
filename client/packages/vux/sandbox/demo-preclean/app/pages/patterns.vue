<template lang="pug">
main.app-shell
  section.panel.intro
    NuxtLink.secondary-link(to="/") Back to demo
    h1 Quest Query Pattern Lab
    p.
      Compare query ergonomics and transition behavior before changing the
      public demo. The current winner preloads realistic quest pools and keeps
      fast status tabs local.
    .meta-grid
      div
        span.label App ID
        span.value {{ appId || 'missing NUXT_PUBLIC_INSTANT_APP_ID' }}
      div
        span.label Signed in
        span.value {{ signedInLabel || 'no' }}
      div
        span.label Current query
        span.value {{ queryPreview }}

  DemoMissingConfigPanel(v-if="!db")

  template(v-else)
    section.panel.pattern-controls
      .toolbar
        span.filter-label Pool
        button(
          v-for="nextPool in questPools"
          :key="nextPool"
          :aria-keyshortcuts="poolShortcutByFilter[nextPool]"
          :class="{ active: questPool === nextPool }"
          :title="`Shortcut: ${poolShortcutByFilter[nextPool].toUpperCase()}`"
          @click="questPool = nextPool"
        ) {{ nextPool }}
      .toolbar
        span.filter-label Status
        button(
          v-for="nextStatus in questStatuses"
          :key="nextStatus"
          :aria-keyshortcuts="statusShortcutByFilter[nextStatus]"
          :class="{ active: questStatus === nextStatus }"
          :title="`Shortcut: ${statusShortcutByFilter[nextStatus].toUpperCase()}`"
          @click="questStatus = nextStatus"
        ) {{ nextStatus }}

      form.quest-form(@submit.prevent="createQuest")
        input(
          v-model="pendingQuestTitle"
          type="text"
          placeholder="Request a quest to compare patterns"
          autocomplete="off"
          :disabled="!canEditQuests"
        )
        button(:disabled="!canEditQuests || !pendingQuestTitle.trim()" type="submit") Request

      .auth-actions
        button.secondary(v-if="!auth?.user.value" :disabled="isAuthenticating" @click="signInAsGuest") Sign in as guest
        button.secondary(v-else @click="signOut") Sign out
      p.quest-status.error(v-if="authErrorMessage") {{ authErrorMessage }}
      p.quest-status.muted(v-else) {{ controlStatusText }}

    section.pattern-grid
      article.panel.pattern-card(v-for="pattern in patterns" :key="pattern.id")
        header.pattern-card-header
          div
            h2.pattern-title
              span.pattern-alias {{ pattern.alias }}
              span {{ pattern.title }}
            p.muted {{ pattern.description }}
          span.pattern-status(
            :aria-label="pattern.status"
            :class="{ loading: pattern.isLoading }"
            :title="pattern.status"
          )

        p.pattern-note {{ pattern.note }}

        .quest-list-shell
          ul.quest-list
            li(v-for="quest in pattern.quests" :key="`${pattern.id}-${quest.id}`")
              label
                input(
                  type="checkbox"
                  :checked="quest.status === 'done'"
                  :disabled="!canEditQuests"
                  @change="toggleQuestCompletion(quest)"
                )
                span.quest-title(:class="{ done: quest.status === 'done' }") {{ quest.title }}
              .quest-actions
                button.secondary(:disabled="!canEditQuests" @click="toggleQuestAssignment(quest)") {{ quest.assignee?.id === auth?.user.value?.id ? 'Release' : 'Claim' }}
                button.danger(:disabled="!canEditQuests" @click="removeQuest(quest)") Delete
          p.quest-empty-state(v-if="pattern.quests.length === 0 && !pattern.isLoading") {{ pattern.emptyText }}
</template>

<script setup lang="ts">
type Quest = InstaQLEntity<AppSchema, 'quests', {
  requestor: {}
  assignee: {}
}>
type QuestPool = 'requested' | 'assigned'
type QuestStatus = 'all' | 'pending' | 'done'

const questPools = ['requested', 'assigned'] as const
const questStatuses = ['all', 'pending', 'done'] as const
const poolShortcutByFilter = {
  requested: 'q',
  assigned: 'w',
} satisfies Record<QuestPool, string>
const statusShortcutByFilter = {
  all: 'a',
  pending: 's',
  done: 'd',
} satisfies Record<QuestStatus, string>
const poolFilterByShortcut = invertShortcutMap(poolShortcutByFilter)
const statusFilterByShortcut = invertShortcutMap(statusShortcutByFilter)

const appId = useRuntimeConfig().public.instantAppId ?? ''
const db = useDb()
const auth = db?.useAuth()

const questPool = ref<QuestPool>('requested')
const questStatus = ref<QuestStatus>('all')
const pendingQuestTitle = ref('')
const authErrorMessage = ref('')
const isAuthenticating = ref(false)

onMounted(() => {
  window.addEventListener('keydown', handleFilterShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleFilterShortcut)
})

const canEditQuests = computed(() => Boolean(auth?.user.value))
const signedInLabel = computed(() => {
  const user = auth?.user.value
  if (!user) {
    return ''
  }

  if (!user.isGuest && user.email) {
    return user.email
  }

  return `Guest-${user.id.slice(-6)}`
})

const statusWhereValue = computed(() => {
  if (questStatus.value === 'pending') {
    return 'pending'
  }

  if (questStatus.value === 'done') {
    return 'done'
  }

  return undefined
})

const isAssignedPoolWithoutUser = computed(() => {
  return questPool.value === 'assigned' && !auth?.user.value?.id
})

function createScopedQuestsQuery() {
  if (isAssignedPoolWithoutUser.value) {
    return null
  }

  return q({
    quests: {
      $: {
        where: {
          'assignee.id': questPool.value === 'assigned' ? auth?.user.value?.id : undefined,
          'status': statusWhereValue.value,
        },
      },
      requestor: {},
      assignee: {},
    },
  })
}

function createPoolOnlyQuestsQuery() {
  if (isAssignedPoolWithoutUser.value) {
    return null
  }

  return q({
    quests: {
      $: {
        where: {
          'assignee.id': questPool.value === 'assigned' ? auth?.user.value?.id : undefined,
        },
      },
      requestor: {},
      assignee: {},
    },
  })
}

function createStatusOnlyQuery() {
  return q({
    quests: {
      $: {
        where: {
          status: statusWhereValue.value,
        },
      },
      requestor: {},
      assignee: {},
    },
  })
}

const allBoardQuestsQuery = db?.useQuery({
  quests: {
    requestor: {},
    assignee: {},
  },
} as const)

const assignedQuestsQuery = db?.useQuery(() => {
  if (!auth?.user.value?.id)
    return null

  return {
    quests: {
      $: {
        where: {
          'assignee.id': auth.user.value.id,
        },
      },
      requestor: {},
      assignee: {},
    },
  } as const
})

const singleQuestsQuery = db?.useQuery(createScopedQuestsQuery)
const stableQuestsQuery = db?.useQuery(createScopedQuestsQuery, {
  keepPreviousData: true,
})
const poolLocalStatusQuery = db?.useQuery(createPoolOnlyQuestsQuery)
const statusOnlyQuery = db?.useQuery(createStatusOnlyQuery)

const preloadedPoolResults = usePreloadedQueryScopes({
  requested: {
    items: () => allBoardQuestsQuery?.data.value?.quests,
    isLoading: () => allBoardQuestsQuery?.isLoading.value ?? false,
    errorMessage: () => allBoardQuestsQuery?.error.value?.message ?? '',
  },
  assigned: {
    items: () => assignedQuestsQuery?.data.value?.quests,
    isLoading: () => assignedQuestsQuery?.isLoading.value ?? false,
    errorMessage: () => assignedQuestsQuery?.error.value?.message ?? '',
  },
}, () => questPool.value)

const hasResolvedSingleQuests = ref(false)
const hasResolvedStableQuests = ref(false)
const hasResolvedPoolLocalStatus = ref(false)
const hasResolvedStatusOnly = ref(false)

watchEffect(() => {
  if (singleQuestsQuery && !singleQuestsQuery.isLoading.value && !singleQuestsQuery.error.value) {
    hasResolvedSingleQuests.value = true
  }
})

watchEffect(() => {
  if (stableQuestsQuery && !stableQuestsQuery.isLoading.value && !stableQuestsQuery.error.value) {
    hasResolvedStableQuests.value = true
  }
})

watchEffect(() => {
  if (poolLocalStatusQuery && !poolLocalStatusQuery.isLoading.value && !poolLocalStatusQuery.error.value) {
    hasResolvedPoolLocalStatus.value = true
  }
})

watchEffect(() => {
  if (statusOnlyQuery && !statusOnlyQuery.isLoading.value && !statusOnlyQuery.error.value) {
    hasResolvedStatusOnly.value = true
  }
})

const boardQuests = computed<Quest[]>(() => allBoardQuestsQuery?.data.value?.quests ?? [])
const baselineQuests = computed(() => filterQuestsByStatus(preloadedPoolResults.items.value))
const singleQuests = computed<Quest[]>(() => singleQuestsQuery?.data.value?.quests ?? [])
const stableQuests = computed<Quest[]>(() => stableQuestsQuery?.data.value?.quests ?? [])
const poolLocalStatusQuests = computed(() => filterQuestsByStatus(poolLocalStatusQuery?.data.value?.quests ?? []))
const noPoolLocalStatusQuests = computed(() => filterQuestsByStatus(boardQuests.value))
const statusOnlyQuests = computed<Quest[]>(() => statusOnlyQuery?.data.value?.quests ?? [])

const queryPreview = computed(() => {
  const assigneeFilter = questPool.value === 'assigned'
    ? auth?.user.value?.id ?? 'skip until signed in (personal pool)'
    : 'undefined'
  const statusFilter = statusWhereValue.value ?? 'undefined'

  return `where: { 'assignee.id': ${assigneeFilter}, status: ${statusFilter} }`
})

const controlStatusText = computed(() => {
  if (isAssignedPoolWithoutUser.value) {
    return 'Assigned is personal and skipped while signed out. Requested remains a public shared pool.'
  }

  if (!auth?.user.value) {
    return 'Signed out: requested stays readable across users. Sign in to mutate quests and compare assigned behavior.'
  }

  return 'Mutations are live; compare whether each panel flashes or keeps useful data during transitions.'
})

const patterns = computed(() => [
  {
    id: 'baseline',
    alias: 'SPLS',
    title: 'Scope preloads + local status',
    description: 'Subscribes to public requested + personal assigned pools, then projects pending/done locally.',
    note: 'Current UX winner. Pool switches stay instant because both pools remain warm, and status tabs are synchronous local filters.',
    quests: baselineQuests.value,
    status: statusFor({
      isLoading: preloadedPoolResults.isLoading.value,
      error: preloadedPoolResults.errorMessage.value
        ? { message: preloadedPoolResults.errorMessage.value }
        : undefined,
    }, preloadedPoolResults.hasResolved.value, baselineQuests.value),
    isLoading: preloadedPoolResults.isLoading.value,
    emptyText: emptyTextFor('baseline'),
  },
  {
    id: 'single',
    alias: 'SQUS',
    title: 'Single query + undefined skip',
    description: 'One reactive query; inactive pool/status filters collapse to undefined.',
    note: 'Ergonomic and upstream-compatible, but manual tests still show a short jitter on rapid tab changes.',
    quests: singleQuests.value,
    status: statusFor({
      isLoading: singleQuestsQuery?.isLoading.value ?? false,
      error: singleQuestsQuery?.error.value,
    }, hasResolvedSingleQuests.value, singleQuests.value),
    isLoading: singleQuestsQuery?.isLoading.value ?? false,
    emptyText: emptyTextFor('single'),
  },
  {
    id: 'pool-local-status',
    alias: 'APLS',
    title: 'Active pool query + local status',
    description: 'Queries only the active public/personal pool and projects pending/done locally.',
    note: 'Isolates status behavior. Pending/done is smooth, but switching requested/assigned still rebases the subscription.',
    quests: poolLocalStatusQuests.value,
    status: statusFor({
      isLoading: poolLocalStatusQuery?.isLoading.value ?? false,
      error: poolLocalStatusQuery?.error.value,
    }, hasResolvedPoolLocalStatus.value, poolLocalStatusQuests.value),
    isLoading: poolLocalStatusQuery?.isLoading.value ?? false,
    emptyText: emptyTextFor('pool-local-status'),
  },
  {
    id: 'no-pool-local-status',
    alias: 'NPLS',
    title: 'No-pool + local status',
    description: 'Ignores personal pools and projects pending/done from the broad board query.',
    note: 'Control case for status smoothness alone. If this is smooth, status jitter is query-switch related, not rendering related.',
    quests: noPoolLocalStatusQuests.value,
    status: statusFor({
      isLoading: allBoardQuestsQuery?.isLoading.value ?? false,
      error: allBoardQuestsQuery?.error.value,
    }, Boolean(allBoardQuestsQuery && !allBoardQuestsQuery.isLoading.value), noPoolLocalStatusQuests.value, { ignoresPoolSkip: true }),
    isLoading: allBoardQuestsQuery?.isLoading.value ?? false,
    emptyText: emptyTextFor('no-pool-local-status', { ignoresPoolSkip: true }),
  },
  {
    id: 'no-pool-query-status',
    alias: 'NPQS',
    title: 'No-pool + query status',
    description: 'Ignores pools, but switches pending/done by mutating query where filters.',
    note: 'Control case for query-level status tabs. If this jitters, the async query transition is the core cause.',
    quests: statusOnlyQuests.value,
    status: statusFor({
      isLoading: statusOnlyQuery?.isLoading.value ?? false,
      error: statusOnlyQuery?.error.value,
    }, hasResolvedStatusOnly.value, statusOnlyQuests.value, { ignoresPoolSkip: true }),
    isLoading: statusOnlyQuery?.isLoading.value ?? false,
    emptyText: emptyTextFor('no-pool-query-status', { ignoresPoolSkip: true }),
  },
  {
    id: 'stable',
    alias: 'SQK',
    title: 'Single query + keepPreviousData',
    description: 'Same as SQUS, with previous data retained while next query result is pending.',
    note: 'Prevents blanking, but still cannot make a changed query resolve synchronously for tab interactions.',
    quests: stableQuests.value,
    status: statusFor({
      isLoading: stableQuestsQuery?.isLoading.value ?? false,
      error: stableQuestsQuery?.error.value,
    }, hasResolvedStableQuests.value, stableQuests.value),
    isLoading: stableQuestsQuery?.isLoading.value ?? false,
    emptyText: emptyTextFor('stable'),
  },
])

function filterQuestsByStatus(quests: Quest[]): Quest[] {
  if (questStatus.value === 'pending') {
    return quests.filter(quest => quest.status === 'pending')
  }

  if (questStatus.value === 'done') {
    return quests.filter(quest => quest.status === 'done')
  }

  return quests
}

function statusFor(
  query: { isLoading?: boolean, error?: { message?: string } } | null | undefined,
  hasResolved: boolean,
  quests: Quest[],
  opts: { ignoresPoolSkip?: boolean } = {},
) {
  if (!opts.ignoresPoolSkip && isAssignedPoolWithoutUser.value) {
    return 'skipped'
  }

  if (query?.error?.message) {
    return query.error.message
  }

  if (query?.isLoading && quests.length > 0) {
    return 'refreshing'
  }

  if (query?.isLoading) {
    return hasResolved ? 'loading next query' : 'loading'
  }

  return 'ready'
}

function emptyTextFor(pattern: string, opts: { ignoresPoolSkip?: boolean } = {}) {
  if (!opts.ignoresPoolSkip && isAssignedPoolWithoutUser.value) {
    return 'Sign in to compare the personal assigned pool. Requested remains public.'
  }

  if (pattern === 'baseline' && preloadedPoolResults.isLoading.value) {
    return 'Loading cached baseline...'
  }

  return 'No quests match this view.'
}

function createQuest() {
  if (!db || !canEditQuests.value || !pendingQuestTitle.value.trim()) {
    return
  }

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

    if (questPool.value === 'assigned') {
      chunks.push(
        db.tx.quests[questId]!.link({
          assignee: auth.user.value.id,
        }),
      )
    }
  }

  db.transact(chunks)
  pendingQuestTitle.value = ''
}

function toggleQuestCompletion(quest: Quest) {
  if (!db || !canEditQuests.value) {
    return
  }

  db.transact(db.tx.quests[quest.id]!.update({
    status: quest.status === 'done' ? 'pending' : 'done',
  }))
}

function toggleQuestAssignment(quest: Quest) {
  if (!db || !canEditQuests.value || !auth?.user.value?.id) {
    return
  }

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
  if (!db || !canEditQuests.value) {
    return
  }

  db.transact(db.tx.quests[quest.id]!.delete())
}

function handleFilterShortcut(event: KeyboardEvent) {
  if (
    event.defaultPrevented
    || event.metaKey
    || event.ctrlKey
    || event.altKey
    || isEditableTarget(event.target)
  ) {
    return
  }

  const key = event.key.toLowerCase()
  const nextPool = poolFilterByShortcut[key]
  if (nextPool) {
    questPool.value = nextPool
    event.preventDefault()
    return
  }

  const nextStatus = statusFilterByShortcut[key]
  if (nextStatus) {
    questStatus.value = nextStatus
    event.preventDefault()
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  )
}

function invertShortcutMap<T extends string>(map: Record<T, string>) {
  return Object.fromEntries(
    Object.entries(map).map(([filter, shortcut]) => [shortcut, filter]),
  ) as Record<string, T>
}

async function signInAsGuest() {
  if (!db) {
    return
  }

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

async function signOut() {
  if (!db) {
    return
  }

  await db.auth.signOut()
}

function formatAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Unexpected error'
  }

  const maybeError = error as { body?: { message?: string }, message?: string }
  return maybeError.body?.message ?? maybeError.message ?? 'Unexpected error'
}
</script>
