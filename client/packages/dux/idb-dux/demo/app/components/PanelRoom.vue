<template lang="pug">
article.card
  .stack
    h3 Realtime Room (presence + topics + typing)
    p.inline-pair
      span.label Room
      code.inline-value workspace/{{ workspaces.current?.id }}

  .demo-two-col
    section.stack.demo-box
      h4 Presence
      ul.presence
        li(v-for="[peerId, peer] in room.peers" :key="peerId")
          span.dot
          span {{ peer.name || 'Anonymous' }}
        li(v-if="room.peers.length === 0")
          span.dot
          span Waiting for peers...
      .typing-status
        p.typing(v-if="room.peersTyping.length > 0")
          template(v-if="room.peersTyping.length === 1") {{ room.peersTyping[0]?.name ?? 'Someone' }} is typing...
          template(
            v-else-if="room.peersTyping.length === 2"
          ) {{ room.peersTyping[0]?.name ?? 'Someone' }} and {{ room.peersTyping[1]?.name ?? 'someone else' }} are typing...
          template(v-else) {{ room.peersTyping[0]?.name ?? 'Someone' }} and {{ room.peersTyping.length - 1 }} more are typing...
        p.muted(v-else) Nobody is typing right now.

    section.stack.demo-box
      h4 Topics
      .row
        button.btn.secondary.compact(type="button" @click="room.publishReaction({ emoji: '🔥' })") 🔥
        button.btn.secondary.compact(type="button" @click="room.publishReaction({ emoji: '🎉' })") 🎉
        button.btn.secondary.compact(type="button" @click="room.publishReaction({ emoji: '❤️' })") ❤️
        button.btn.secondary.compact(type="button" @click="room.publishReaction({ emoji: '👋' })") 👋
      ul.task-list.demo-reaction-list(v-if="room.reactions.length")
        li.demo-reaction-item(v-for="reaction in room.reactions" :key="reaction.id")
          span.demo-reaction-emoji {{ reaction.emoji }}
          span.demo-reaction-sender {{ reaction.sender }}
      p.muted(v-else) No reactions yet.

  .stack
    h4 Try typing
    textarea.input.demo-typing-input(
      v-model.trim="room.typedText"
      rows="3"
      placeholder="Type here and open another tab..."
      @keydown="room.handleTypingKeydown"
      @blur="room.handleTypingBlur"
    )
</template>

<script setup lang="ts">
const workspaces = useWorkspaces()
const room = useRoom()
</script>
