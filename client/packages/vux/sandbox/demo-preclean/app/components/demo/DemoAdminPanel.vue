<template lang="pug">
article.panel.admin
  h3 Server Admin SDK (Nuxt API)
  p.muted.
    This panel uses server routes powered by #[code @instantdb/admin].
    Client-side quests still use realtime #[code db.transact] directly.

  .admin-actions
    button.secondary(:disabled="demo.isLoadingAdminOverview" @click="demo.loadAdminOverview") Refresh server overview
    button.danger(
      :disabled="demo.isPurgingCompleted"
      @click="demo.purgeCompletedQuestsWithAdmin"
    ) Purge completed quests (server)

  p.quest-status.error(v-if="demo.adminErrorMessage") {{ demo.adminErrorMessage }}
  p.quest-status.muted(v-else-if="demo.adminActionMessage") {{ demo.adminActionMessage }}

  .admin-grid(v-if="demo.adminOverview")
    div
      span.label Total quests
      span.value {{ demo.adminOverview.counts.totalQuests }}
    div
      span.label Completed quests
      span.value {{ demo.adminOverview.counts.doneQuests }}
    div
      span.label Pending quests
      span.value {{ demo.adminOverview.counts.pendingQuests }}
    div
      span.label Users
      span.value {{ demo.adminOverview.counts.userCount }}

  p.muted(v-if="demo.adminOverview")
    | Synced cookie user:
    | #[strong {{ demo.adminOverview.syncedUser?.email || demo.adminOverview.syncedUser?.id || 'none' }}]
  p.muted(v-if="demo.adminOverview")
    | Server snapshot time:
    | #[code {{ demo.adminOverview.generatedAt }}]
</template>

<script setup lang="ts">
const demo = useDemoStore()

onMounted(() => {
  demo.loadAdminOverview()
})
</script>
