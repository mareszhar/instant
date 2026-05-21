<template lang="pug">
article.card
  .stack
    h3 Infinite Tasks (useInfiniteQueryX)

    .segmented
      button(
        v-for="statusName in feed.statusFilters"
        :key="statusName"
        type="button"
        :class="{ 'is-active': feed.statusFilter === statusName }"
        @click="feed.statusFilter = statusName"
      ) {{ statusName }}

    .segmented
      button(
        v-for="size in feed.pageSizes"
        :key="size"
        type="button"
        :class="{ 'is-active': feed.pageSize === size }"
        @click="feed.pageSize = size"
      ) {{ size }}

  p.alert.danger(v-if="feed.queryError") {{ feed.queryError }}
  p.alert.danger(v-else-if="feed.actionError") {{ feed.actionError }}
  p.alert.info(v-else-if="feed.actionMessage") {{ feed.actionMessage }}

  ul.task-list.demo-scroll
    li.task(v-for="task in feed.visibleTasks" :key="`infinite-${task.id}`")
      button.check(
        type="button"
        :class="{ 'is-checked': task.isDone }"
        :aria-label="task.isDone ? 'Mark task pending' : 'Mark task done'"
        :disabled="!feed.canEdit || feed.isMutating"
        @click="feed.toggleTaskDone(task)"
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
                :disabled="!feed.canEdit || feed.isMutating"
                @click="runTaskAction(task.id, () => feed.toggleTaskAssignee(task))"
              ) {{ task.assignee?.id === feed.currentUserId ? 'Unassign me' : 'Assign me' }}
            li(role="none")
              button(
                type="button"
                role="menuitem"
                :disabled="!feed.canEdit || feed.isMutating"
                @click="runTaskAction(task.id, () => feed.deleteTask(task.id))"
              ) Delete

      .task__meta
        span.badge.warning(v-if="task.assignee") assignee: {{ formatAssignee(task) }}

  .feed-footer
    p.muted {{ feed.statusText }}
    button.btn.secondary(
      type="button"
      :disabled="!feed.canLoadNextPage || feed.isLoading"
      @click="feed.loadNextPage"
    ) Load next page

  .row
    button.btn.secondary(
      type="button"
      :disabled="!feed.canSeed"
      @click="feed.seedSampleTasks"
    ) Seed 12 tasks
    button.btn.danger(
      type="button"
      :disabled="!feed.canClear"
      @click="feed.clearSeededTasks"
    ) Clear seeded
</template>

<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
}>()

const feed = useInfiniteTasks(props.workspaceId)
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
  if (task.assignee?.id === feed.currentUserId)
    return 'me'

  const email = task.assignee?.email?.trim()
  if (email)
    return email

  return task.assignee?.id.slice(-6) ?? 'unknown'
}
</script>
