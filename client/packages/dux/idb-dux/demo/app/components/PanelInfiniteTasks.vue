<template lang="pug">
article.card
  .stack
    h3 Infinite Tasks (useInfiniteQuery)

    .segmented
      button(
        v-for="status in infiniteTasks.statusFilters"
        :key="status"
        type="button"
        :class="{ 'is-active': infiniteTasks.activeStatusFilter === status }"
        @click="infiniteTasks.setActiveStatusFilter(status)"
      ) {{ status }}

    .segmented
      button(
        v-for="size in infiniteTasks.pageSizes"
        :key="size"
        type="button"
        :class="{ 'is-active': infiniteTasks.activePageSize === size }"
        @click="infiniteTasks.setActivePageSize(size)"
      ) {{ size }}

  p.alert(
    v-if="infiniteTasks.form.feedback"
    :class="infiniteTasks.form.feedback.tone"
  ) {{ infiniteTasks.form.feedback.text }}

  ul.task-list.demo-scroll
    ItemTask(
      v-for="task in infiniteTasks.shown"
      :key="task.id"
      :context-menu="contextMenu"
      :task
      @toggle-check="infiniteTasks.toggleCheck(task)"
      @toggle-claim="infiniteTasks.toggleClaim(task)"
      @remove="infiniteTasks.remove(task)"
    )

  .feed-footer
    p.muted
      template(v-if="infiniteTasks.isLoading") Loading feed...
      template(v-else-if="infiniteTasks.error") Error loading feed: {{ formatError(infiniteTasks.error) }}
      template(v-else-if="!infiniteTasks.shown.length") No tasks for this filter yet. Seed sample tasks to test pagination.
      template(v-else-if="infiniteTasks.canLoadNextPage") More pages available. Load the next page to extend the feed.
      template(v-else) End of list reached for the current filters.
    button.btn.secondary(
      type="button"
      :disabled="!infiniteTasks.canLoadNextPage || infiniteTasks.isLoading"
      @click="infiniteTasks.loadNextPage"
    ) Load next page

  .row
    button.btn.secondary(
      type="button"
      :disabled="!auth.user"
      @click="() => infiniteTasks.seedSample(12)"
    ) Seed 12 tasks
    button.btn.danger(
      type="button"
      :disabled="!auth.user"
      @click="infiniteTasks.clearSeeded"
    ) Clear seeded
</template>

<script setup lang="ts">
const { auth } = useIdb()
const infiniteTasks = useInfiniteTasksStore()
const contextMenu = useContextMenu()
</script>
