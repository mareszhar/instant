<template lang="pug">
article.panel.realtime
  h3 Realtime Room Features
  p.muted Room: #[code demo/main]

  .presence-block
    h4 Presence
    p.muted.
      You publish your display name and connection session state automatically.
      Session state is transport-level (connected/authenticating), not login identity.
    ul
      li(v-for="[peerId, peer] in demo.presencePeers" :key="peerId")
        strong {{ peer.name || 'Unknown' }}
        span.muted.peer-status ({{ peer.status || 'no status' }})

  .topics-block
    h4 Topics
    .reaction-buttons
      button(@click="demo.sendReaction('🔥')") 🔥
      button(@click="demo.sendReaction('🎉')") 🎉
      button(@click="demo.sendReaction('❤️')") ❤️
      button(@click="demo.sendReaction('👋')") 👋
    button.secondary(@click="demo.sendPing") Send ping topic
    p.muted Topic events received: {{ demo.topicEventTotal }}
    ul
      li(v-for="reaction in demo.recentReactions" :key="reaction.id")
        span {{ reaction.emoji }}
        span.muted  from {{ reaction.sender }}

  .typing-block
    h4 Typing Indicator
    textarea(
      v-model="demo.typingDraftMessage"
      placeholder="Type here and open another tab..."
      rows="3"
      @keydown="demo.handleTypingKeydown"
      @blur="demo.handleTypingBlur"
    )
    p.muted(v-text="demo.typingIndicatorText || '\u00a0'")
</template>

<script setup lang="ts">
const demo = useDemoStore()
</script>
