<template lang="pug">
section.card
  h3 Missing Runtime Config
  .stack
    .alert.warning Add #[code NUXT_PUBLIC_INSTANT_APP_ID] to #[code .env] and restart Nuxt.
    p.muted The demo initializes only after a public Instant app id is available.
</template>

<script setup lang="ts">
</script>
