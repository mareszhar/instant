<template lang="pug">
section.panel.cursor-panel
  h3 Cursors
  p.muted Open this demo in two tabs and move your pointer in the area below.
  Cursors(
    v-if="proxySafeRoom"
    :room="proxySafeRoom"
    className="cursor-space"
    userCursorColor="#ff6b35"
  )
    template(#cursor="{ color, presence: peerPresence }")
      .peer-cursor(:style="{ borderColor: color || '#222' }")
        | {{ peerPresence?.name?.slice(0, 1)?.toUpperCase() || '•' }}
    .cursor-canvas
      p Move your mouse around this region.
</template>

<script setup lang="ts">
import { Cursors } from '@mszr/idb-vux'

const db = useDb()
const proxySafeRoom = db ? markRaw(db.room('demo', 'main')) : null
</script>
