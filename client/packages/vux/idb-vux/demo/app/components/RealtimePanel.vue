<template lang="pug">
article.card
  .stack
    h3 Realtime Room (presence + topics + typing)
    p.inline-pair
      span.label Room
      code.inline-value workspace/{{ workspaceId }}

  .demo-two-col
    section.stack.demo-box
      h4 Presence
      ul.presence
        li(v-for="[peerId, peer] in realtime.presencePeers" :key="peerId")
          span.dot
          span {{ peer.name || 'Anonymous' }}
        li(v-if="realtime.presencePeers.length === 0")
          span.dot
          span Waiting for peers...
      .typing-status
        p.typing(v-if="realtime.typingIndicatorText") {{ realtime.typingIndicatorText }}
        p.muted(v-else) Nobody is typing right now.

    section.stack.demo-box
      h4 Topics
      .row
        button.btn.secondary.compact(type="button" @click="realtime.sendReaction('🔥')") 🔥
        button.btn.secondary.compact(type="button" @click="realtime.sendReaction('🎉')") 🎉
        button.btn.secondary.compact(type="button" @click="realtime.sendReaction('❤️')") ❤️
        button.btn.secondary.compact(type="button" @click="realtime.sendReaction('👋')") 👋
      ul.task-list.demo-reaction-list(v-if="realtime.reactions.length")
        li.demo-reaction-item(v-for="reaction in realtime.reactions" :key="reaction.id")
          span.demo-reaction-emoji {{ reaction.emoji }}
          span.demo-reaction-sender {{ reaction.sender }}
      p.muted(v-else) No reactions yet.

  .stack
    h4 Try typing
    textarea.input.demo-typing-input(
      v-model="realtime.typingDraft"
      rows="3"
      placeholder="Type here and open another tab..."
      @keydown="realtime.handleTypingKeydown"
      @blur="realtime.handleTypingBlur"
    )
</template>

<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
  userLabel: string
}>()

const userLabel = toRef(props, 'userLabel')

const realtime = useWorkspaceRealtime(
  props.workspaceId,
  userLabel,
)
</script>
