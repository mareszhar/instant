<template lang="pug">
article.card
  .stack
    h3 Cursors
    p.muted Open the same workspace in two tabs to see cursors moving below.

  Cursors(
    :room="room.current"
    className="demo-cursor-space"
    userCursorColor="#ef6200"
  )
    template(#cursor="{ color, presence: peerPresence }")
      .demo-peer-cursor(:style="{ borderColor: color || '#222' }")
        | {{ peerPresence?.name?.slice(0, 1)?.toUpperCase() || '•' }}
    .demo-cursor-canvas
      p.muted Move your cursor around this region.
</template>

<script setup lang="ts">
import { Cursors } from '@mszr/idb-vux'

const room = useRoom()
</script>
