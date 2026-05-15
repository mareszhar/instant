<template lang="pug">
article.panel.quests
  h3 Quest Board (useQuery + transact)

  .toolbar
    span.filter-label Pool
    button(
      v-for="poolName in demo.questPoolFilters"
      :key="poolName"
      :class="{ active: demo.questPoolFilter === poolName }"
      @click="demo.setQuestPoolFilter(poolName)"
    ) {{ poolName }}

  .toolbar
    span.filter-label Status
    button(
      v-for="statusName in demo.questStatusFilters"
      :key="statusName"
      :class="{ active: demo.questStatusFilter === statusName }"
      @click="demo.setQuestStatusFilter(statusName)"
    ) {{ statusName }}

  form.quest-form(@submit.prevent="demo.createQuest")
    input(
      v-model="demo.pendingQuestTitle"
      type="text"
      placeholder="Request a quest"
      autocomplete="off"
      :disabled="!demo.canEditQuests"
    )
    button(:disabled="!demo.canEditQuests || !demo.pendingQuestTitle.trim()" type="submit") Request

  p.quest-status(:class="{ error: Boolean(demo.questErrorMessage), muted: !demo.questErrorMessage }") {{ demo.questStatusText }}

  .quest-list-shell
    ul.quest-list
      li(v-for="quest in demo.filteredQuests" :key="quest.id")
        label
          input(
            type="checkbox"
            :checked="quest.status === 'done'"
            :disabled="!demo.canEditQuests"
            @change="demo.toggleQuestCompletion(quest)"
          )
          span.quest-title(:class="{ done: quest.status === 'done' }") {{ quest.title }}

        .quest-actions
          button.secondary(
            :disabled="!demo.canEditQuests"
            @click="demo.toggleQuestAssignment(quest)"
          ) {{ quest.assignee?.id === demo.signedInUserId ? 'Release' : 'Claim' }}
          button.danger(:disabled="!demo.canEditQuests" @click="demo.removeQuest(quest)") Delete

  .quest-footer
    span {{ demo.pendingQuestCount }} pending
    button.secondary(:disabled="!demo.canEditQuests" @click="demo.clearCompletedQuests") Clear completed (requested by me)
</template>

<script setup lang="ts">
const demo = useDemoStore()
</script>
