<template lang="pug">
section.card.demo-intro
  .stack
    h1.demo-intro__title idb-dux demo
    p.subtitle
      | Create or join a workspace, then open multiple tabs or devices to test realtime sync.
    p.muted
      | Covers auth, typed queries, transactions, infinite feeds, presence, topics, cursors, admin routes, and webhooks.

  .stats
    .stat
      span.label App ID
      code.inline-value {{ useRuntimeConfig().public.instantAppId || 'missing NUXT_PUBLIC_INSTANT_APP_ID' }}
    .stat
      span.label Connection
      code.inline-value {{ access.connectionStatus }}
    .stat
      span.label Local Device
      code.inline-value {{ access.localId }}
</template>

<script setup lang="ts">
const access = useAccess()
</script>
