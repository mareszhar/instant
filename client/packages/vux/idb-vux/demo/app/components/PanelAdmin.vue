<template lang="pug">
article.card
  .stack
    h3 Server Admin Routes
    p.muted Server summary and cleanup powered by #[code @instantdb/admin].

  .row
    button.btn.secondary(
      type="button"
      :disabled="admin.isLoadingSummary"
      @click="admin.refreshSummary"
    ) Refresh summary
    button.btn.danger(
      type="button"
      :disabled="admin.isClearingDone"
      @click="admin.clearDoneWithAdmin"
    ) Clear done tasks (server)

  p.alert.danger(v-if="admin.errorMessage") {{ admin.errorMessage }}
  p.alert.info(v-else-if="admin.actionMessage") {{ admin.actionMessage }}

  .stats(v-if="admin.summary")
    .stat
      span.label Total Tasks
      strong {{ admin.summary.counts.totalTasks }}
    .stat
      span.label Done Tasks
      strong {{ admin.summary.counts.doneTasks }}
    .stat
      span.label Pending Tasks
      strong {{ admin.summary.counts.pendingTasks }}
    .stat
      span.label Members
      strong {{ admin.summary.counts.memberCount }}

  p.inline-pair(v-if="admin.summary")
    span.label Synced Cookie User
    span.inline-value {{ admin.summary.syncedUser?.email || admin.summary.syncedUser?.id || 'none' }}
  p.inline-pair(v-if="admin.summary")
    span.label Snapshot
    code.inline-value {{ admin.summary.generatedAt }}
</template>

<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
}>()

const admin = useAdminTools(props.workspaceId)

onMounted(() => {
  admin.refreshSummary()
})
</script>
