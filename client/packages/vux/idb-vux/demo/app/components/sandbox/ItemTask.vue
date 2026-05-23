<template lang="pug">
li.task
  button.check(
    type="button"
    :class="{ 'is-checked': task.isDone }"
    :aria-label="task.isDone ? 'Mark task pending' : 'Mark task done'"
    :disabled="!auth.user"
    @click="$emit('toggleCheck')"
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
            @click="contextMenu.run(() => $emit('toggleClaim'))"
          ) {{ task.assignee?.id === auth.user?.id ? 'Unassign me' : 'Assign me' }}
        li(role="none")
          button(
            type="button"
            role="menuitem"
            :disabled="!auth.user"
            @click="contextMenu.run(() => $emit('remove'))"
          ) Delete

  .task__meta
    span.badge.warning(v-if="task.assignee") assignee: {{ userToLabel(task.assignee, auth.user) }}
</template>

<script setup lang="ts">
defineProps<{
  contextMenu: ReturnType<typeof useContextMenu<string>>
  task: TaskWithAssignee
}>()

defineEmits<{
  remove: []
  toggleCheck: []
  toggleClaim: []
}>()

const { auth } = useIdb()
</script>
