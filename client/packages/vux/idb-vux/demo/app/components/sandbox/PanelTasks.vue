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
    li.task(v-for="task in tasks.shown" :key="task.id")
      button.check(
        type="button"
        :class="{ 'is-checked': task.isDone }"
        :aria-label="task.isDone ? 'Mark task pending' : 'Mark task done'"
        :disabled="!auth.user"
        @click="tasks.toggleCheck(task)"
      ) #[span]

      p.task__title(:class="{ 'is-done': task.isDone }") {{ task.title }}

      .menu.task__menu
        button.btn.ghost.icon.menu__trigger(
          :ref="element => contextMenu.setAnchorElement(task.id, element)"
          type="button"
          aria-label="Task actions"
          :aria-expanded="contextMenu.activeAnchorId === task.id"
          @click.stop="contextMenu.toggle(task.id)"
        ) ⋯
        Teleport(to="body")
          ul.context-menu.context-menu--floating(
            v-if="contextMenu.activeAnchorId === task.id"
            :ref="contextMenu.setFloatingElement"
            :style="contextMenu.floatingStyles"
            role="menu"
            @click.stop
          )
            li(role="none")
              button(
                type="button"
                role="menuitem"
                :disabled="!auth.user"
                @click="contextMenu.run(() => tasks.toggleClaim(task))"
              ) {{ task.assignee?.id === auth.user?.id ? 'Unassign me' : 'Assign me' }}
            li(role="none")
              button(
                type="button"
                role="menuitem"
                :disabled="!auth.user"
                @click="contextMenu.run(() => tasks.remove(task))"
              ) Delete

      .task__meta
        span.badge.warning(v-if="task.assignee") assignee: {{ userToLabel(task.assignee, auth.user) }}

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
