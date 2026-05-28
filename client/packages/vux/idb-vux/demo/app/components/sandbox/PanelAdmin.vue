<template lang="pug">
article.card
  .stack
    h3 Server Admin Routes
    p.muted Server summary and cleanup powered by #[code @instantdb/admin].

  .row
    button.btn.secondary(
      type="button"
      :disabled="admin.form.isProcessing"
      @click="admin.refreshWorkspaceSummary"
    ) Refresh summary
    button.btn.danger(
      type="button"
      :disabled="admin.form.isProcessing"
      @click="admin.removeDoneTasks"
    ) Clear done tasks (server)

  p.alert(v-if="admin.form.feedback" :class="admin.form.feedback.tone") {{ admin.form.feedback.text }}

  .stats(v-if="admin.workspaceSummary")
    .stat
      span.label Total Tasks
      strong {{ admin.workspaceSummary.counts.totalTasks }}
    .stat
      span.label Done Tasks
      strong {{ admin.workspaceSummary.counts.doneTasks }}
    .stat
      span.label Pending Tasks
      strong {{ admin.workspaceSummary.counts.pendingTasks }}
    .stat
      span.label Members
      strong {{ admin.workspaceSummary.counts.memberCount }}

  p.inline-pair(v-if="admin.workspaceSummary")
    span.label Synced Cookie User
    span.inline-value {{ admin.workspaceSummary.syncedUser || 'none' }}
  p.inline-pair(v-if="admin.workspaceSummary")
    span.label Snapshot
    code.inline-value {{ admin.workspaceSummary.generatedAt }}
</template>

<script setup lang="ts">
const admin = useAdmin()

onMounted(() => {
  admin.refreshWorkspaceSummary()
})
</script>
