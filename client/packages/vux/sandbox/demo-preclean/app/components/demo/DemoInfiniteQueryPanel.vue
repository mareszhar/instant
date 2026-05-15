<template lang="pug">
article.panel.infinite
  h3 Infinite Query (useInfiniteQuery)
  p.muted.
    This panel subscribes with #[code db.useInfiniteQuery], loads page windows incrementally,
    and keeps the same plain query object shape used by #[code useQuery].

  .toolbar
    span.filter-label Status
    button(
      v-for="statusName in statusFilters"
      :key="statusName"
      :class="{ active: selectedStatus === statusName }"
      @click="selectedStatus = statusName"
    ) {{ statusName }}

  .toolbar
    span.filter-label Limit
    button(
      v-for="limit in pageSizeFilters"
      :key="limit"
      :class="{ active: pageSize === limit }"
      @click="pageSize = limit"
    ) {{ limit }}

  .infinite-actions
    button.secondary(
      :disabled="!canLoadNextPage || isLoading"
      @click="loadNextPage"
    ) Load next page
    button.secondary(
      :disabled="!canSeedSampleQuests"
      @click="seedSampleQuests"
    ) Seed 12 sample quests
    button.danger(
      :disabled="!canClearSampleQuests"
      @click="clearSeededQuests"
    ) Clear seeded sample quests

  p.quest-status.error(v-if="errorMessage") {{ errorMessage }}
  p.quest-status.muted(v-else-if="seedActionMessage") {{ seedActionMessage }}
  p.quest-status.muted(v-else) {{ statusText }}

  .meta-grid
    div
      span.label Loaded rows
      span.value {{ visibleQuests.length }}
    div
      span.label Can load next page
      span.value {{ canLoadNextPage ? 'yes' : 'no' }}
    div
      span.label Query key
      span.value status={{ selectedStatus }} limit={{ pageSize }}

  .quest-list-shell
    ul.quest-list
      li(v-for="quest in visibleQuests" :key="`infinite-${quest.id}`")
        span.quest-title(:class="{ done: quest.status === 'done' }")
          | {{ quest.title }}
          |  ·
          |  {{ quest.status }}
        .quest-actions
          span.muted {{ formatCreatedAt(quest.createdAt) }}
</template>

<script setup lang="ts">
type Quest = InstaQLEntity<AppSchema, 'quests', {
  requestor: {}
  assignee: {}
}>
type QuestStatus = 'all' | 'done' | 'pending'

const db = useDb()
const auth = db?.useAuth()

const selectedStatus = ref<QuestStatus>('all')
const pageSize = ref<3 | 5 | 10>(5)
const isSeedingSampleQuests = ref(false)
const isClearingSampleQuests = ref(false)
const seedActionMessage = ref('')

const statusFilters = ['all', 'pending', 'done'] as const
const pageSizeFilters = [3, 5, 10] as const

const infiniteState = db?.useInfiniteQuery(() => {
  const where = selectedStatus.value === 'all'
    ? undefined
    : { status: selectedStatus.value }

  return q({
    quests: {
      $: {
        where,
        order: {
          createdAt: 'desc',
        },
        limit: pageSize.value,
      },
      requestor: {},
      assignee: {},
    },
  })
})

const visibleQuests = computed<Quest[]>(() => infiniteState?.data.value?.quests ?? [])

const canLoadNextPage = computed(() => Boolean(infiniteState?.canLoadNextPage.value))
const isLoading = computed(() => Boolean(infiniteState?.isLoading.value))
const errorMessage = computed(() => infiniteState?.error.value?.message ?? '')
const canSeedSampleQuests = computed(() => {
  return Boolean(db && auth?.user.value?.id && !isSeedingSampleQuests.value)
})
const canClearSampleQuests = computed(() => {
  return Boolean(db && auth?.user.value?.id && !isClearingSampleQuests.value)
})

const statusText = computed(() => {
  if (!db) {
    return 'Database not configured.'
  }

  if (errorMessage.value) {
    return errorMessage.value
  }

  if (isLoading.value && visibleQuests.value.length === 0) {
    return 'Loading current query window...'
  }

  if (visibleQuests.value.length === 0) {
    return 'No quests found for this filter. Seed sample quests or switch status.'
  }

  if (canLoadNextPage.value) {
    return 'More pages available. Click "Load next page" to extend this result.'
  }

  return 'End of list reached for the current filter.'
})

function loadNextPage() {
  infiniteState?.loadNextPage()
}

async function seedSampleQuests() {
  if (!db || !auth?.user.value?.id || isSeedingSampleQuests.value) {
    return
  }

  isSeedingSampleQuests.value = true
  seedActionMessage.value = ''

  try {
    const userId = auth.user.value.id
    const baseNow = Date.now()
    const chunks = []

    for (let index = 0; index < 12; index += 1) {
      const questId = id()
      const isDone = index % 3 === 0
      const title = `Infinite sample quest ${index + 1}`

      chunks.push(
        db.tx.quests[questId]!.update({
          title,
          status: isDone ? 'done' : 'pending',
          createdAt: baseNow + index,
        }),
      )

      chunks.push(
        db.tx.quests[questId]!.link({
          requestor: userId,
        }),
      )

      if (index % 2 === 0) {
        chunks.push(
          db.tx.quests[questId]!.link({
            assignee: userId,
          }),
        )
      }
    }

    await db.transact(chunks)
    seedActionMessage.value = 'Seeded 12 sample quests.'
  }
  catch (error) {
    const maybeError = error as { body?: { message?: string }, message?: string } | undefined
    seedActionMessage.value = maybeError?.body?.message ?? maybeError?.message ?? 'Failed to seed sample quests.'
  }
  finally {
    isSeedingSampleQuests.value = false
  }
}

async function clearSeededQuests() {
  if (!db || !auth?.user.value?.id || isClearingSampleQuests.value) {
    return
  }

  isClearingSampleQuests.value = true
  seedActionMessage.value = ''

  try {
    const response = await db.queryOnce({
      quests: {
        $: {
          where: {
            title: { $like: 'Infinite sample quest %' },
          },
          limit: 500,
        },
      },
    } as const)

    const seededQuests = response.data.quests ?? []
    if (seededQuests.length === 0) {
      seedActionMessage.value = 'No seeded sample quests found.'
      return
    }

    await db.transact(
      seededQuests.map(quest => db.tx.quests[quest.id]!.delete()),
    )
    seedActionMessage.value = `Deleted ${seededQuests.length} seeded sample quest${seededQuests.length === 1 ? '' : 's'}.`
  }
  catch (error) {
    const maybeError = error as { body?: { message?: string }, message?: string } | undefined
    seedActionMessage.value = maybeError?.body?.message ?? maybeError?.message ?? 'Failed to clear seeded sample quests.'
  }
  finally {
    isClearingSampleQuests.value = false
  }
}

function formatCreatedAt(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as string | number)
  if (Number.isNaN(date.getTime())) {
    return 'unknown time'
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}
</script>
