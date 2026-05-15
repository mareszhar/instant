<template lang="pug">
section.panel.intro
  h1 @mszr/idb-vux + Nuxt 4 Demo
  p.
    This demo runs client-first (SSR disabled by default) and showcases a quest board built
    with query/transact, auth guards, presence/topics, typing indicator, cursors, and server Admin SDK routes.
  NuxtLink.secondary-link(to="/patterns") Open query pattern lab
  .meta-grid
    div
      span.label App ID
      span.value {{ appId || 'missing NUXT_PUBLIC_INSTANT_APP_ID' }}
    div
      span.label Connection
      span.value {{ demo.connectionLabel }}
    div
      span.label Local ID
      span.value {{ demo.localIdLabel }}
</template>

<script setup lang="ts">
const demo = useDemoStore()
const appId = useRuntimeConfig().public.instantAppId ?? ''
</script>
