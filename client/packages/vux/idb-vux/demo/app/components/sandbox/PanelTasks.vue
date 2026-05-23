<template lang="pug">
article.card
  .stack
    h3 Tasks (useQueryX + transact)

    .segmented
      button(
        v-for="status in tasks.statusFilters"
        :key="status"
        type="button"
        :class="{ 'is-active': tasks.activeStatusFilter === status }"
        @click="tasks.setActiveStatusFilter(status)"
      ) {{ status }}

    form.composer(@submit.prevent="tasks.create")
      input.input(
        v-model.trim="tasks.form.title"
        type="text"
        placeholder="Do a nice deed..."
        autocomplete="off"
        :disabled="!auth.user"
      )
      button.btn(
        type="submit"
        :disabled="!auth.user || !tasks.form.title || tasks.form.isProcessing"
      ) Add

  p.alert(v-if="tasks.form.feedback" :class="tasks.form.feedback.tone") {{ tasks.form.feedback.text }}
  p.muted(v-else)
    template(v-if="tasks.isLoading") Loading tasks...
    template(v-else-if="tasks.error") Error loading tasks: {{ formatError(tasks.error) }}
    template(v-else-if="!tasks.available.length") No tasks yet. Create your first one.
    template(v-else-if="!tasks.shown.length") No {{ tasks.activeStatusFilter }} tasks found.
    template(v-else) {{ tasks.shown.length }} task{{ tasks.shown.length === 1 ? '' : 's' }} visible.

  .chip-list
    span.badge {{ tasks.byStatus.pending.length }} pending
    span.badge.success {{ tasks.byStatus.done.length }} done

  ul.task-list.demo-scroll
    SandboxItemTask(
      v-for="task in tasks.shown"
      :key="task.id"
      :context-menu="contextMenu"
      :task
      @toggle-check="tasks.toggleCheck(task)"
      @toggle-claim="tasks.toggleClaim(task)"
      @remove="tasks.remove(task)"
    )

  .row.demo-end
    button.btn.secondary(
      type="button"
      :disabled="!auth.user"
      @click="tasks.removeDone"
    ) Clear done tasks
</template>

<script setup lang="ts">
const { auth } = useIdb()
const tasks = useTasks()
const contextMenu = useContextMenu()
</script>
