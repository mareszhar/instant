<template lang="pug">
article.card
  .stack
    h3 Tasks (useQueryX + transact)

    .segmented
      button(
        v-for="statusName in tasks.statusFilters"
        :key="statusName"
        type="button"
        :class="{ 'is-active': tasks.statusFilter === statusName }"
        @click="tasks.setStatusFilter(statusName)"
      ) {{ statusName }}

    form.composer(@submit.prevent="tasks.createTask")
      input.input(
        v-model="tasks.titleInput"
        type="text"
        placeholder="Do a nice deed..."
        autocomplete="off"
        :disabled="!tasks.canEdit"
      )
      button.btn(
        type="submit"
        :disabled="!tasks.canEdit || !tasks.titleInput.trim() || tasks.isMutating"
      ) Add

  p.alert.danger(v-if="tasks.queryError") {{ tasks.queryError }}
  p.alert.danger(v-else-if="tasks.actionError") {{ tasks.actionError }}
  p.alert.info(v-else-if="tasks.actionMessage") {{ tasks.actionMessage }}
  p.muted(v-else) {{ tasks.statusText }}

  .chip-list
    span.badge {{ tasks.pendingCount }} pending
    span.badge.success {{ tasks.doneCount }} done

  ul.task-list.demo-scroll
    li.task(v-for="task in tasks.visibleTasks" :key="task.id")
      button.check(
        type="button"
        :class="{ 'is-checked': task.isDone }"
        :aria-label="task.isDone ? 'Mark task pending' : 'Mark task done'"
        :disabled="tasks.isMutating"
        @click="tasks.toggleTaskDone(task)"
      )
        span

      p.task__title(:class="{ 'is-done': task.isDone }") {{ task.title }}

      .menu.task__menu
        button.btn.ghost.icon.menu__trigger(
          :ref="element => setTriggerRef(task.id, element)"
          type="button"
          aria-label="Task actions"
          :aria-expanded="openMenuId === task.id"
          @click.stop="toggleMenu(task.id)"
        ) ⋯
        Teleport(to="body")
          ul.context-menu.context-menu--floating(
            v-if="openMenuId === task.id"
            ref="floatingMenuElement"
            :style="floatingMenuStyle"
            role="menu"
            @click.stop
          )
            li(role="none")
              button(
                type="button"
                role="menuitem"
                :disabled="!tasks.canEdit || tasks.isMutating"
                @click="runTaskAction(task.id, () => tasks.toggleTaskAssignee(task))"
              ) {{ task.assignee?.id === signedInUserId ? 'Unassign me' : 'Assign me' }}
            li(role="none")
              button(
                type="button"
                role="menuitem"
                :disabled="!tasks.canEdit || tasks.isMutating"
                @click="runTaskAction(task.id, () => tasks.deleteTask(task.id))"
              ) Delete

      .task__meta
        span.badge.warning(v-if="task.assignee") assignee: {{ formatAssignee(task) }}

  .row.demo-end
    button.btn.secondary(
      type="button"
      :disabled="!tasks.canEdit || tasks.isMutating"
      @click="tasks.clearDoneTasks"
    ) Clear done tasks
</template>

<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
  signedInUserId: string
}>()

const tasks = useTasksComp(props.workspaceId)
const signedInUserId = toRef(props, 'signedInUserId')
const {
  openMenuId,
  floatingMenuElement,
  floatingMenuStyle,
  setTriggerRef,
  toggleMenu,
  runTaskAction,
} = useFloatingTaskMenu()

function formatAssignee(task: {
  assignee?: {
    id: string
    email?: string | null
  } | null
}): string {
  if (task.assignee?.id === signedInUserId.value)
    return 'me'

  const email = task.assignee?.email?.trim()
  if (email)
    return email

  return task.assignee?.id.slice(-6) ?? 'unknown'
}
</script>
