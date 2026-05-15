<template lang="pug">
section.card.demo-intro
  .stack
    h1.demo-intro__title idb-vux demo
    p.subtitle
      | Create or join a workspace, then open multiple tabs or devices to test realtime sync.
    p.muted
      | Covers auth, typed queries, transactions, infinite feeds, presence, topics, cursors, and admin routes.

  .stats
    .stat
      span.label App ID
      code.inline-value {{ appId || 'missing NUXT_PUBLIC_INSTANT_APP_ID' }}
    .stat
      span.label Connection
      code.inline-value {{ connectionLabel }}
    .stat
      span.label Local Device
      code.inline-value {{ localIdLabel }}
</template>

<script setup lang="ts">
defineProps<{
  appId: string
  connectionLabel: string
  localIdLabel: string
}>()
</script>
