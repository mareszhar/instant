<template lang="pug">
main.app-shell
  DemoIntroPanel

  DemoMissingConfigPanel(v-if="!demo.hasDatabase")

  template(v-else)
    DemoAuthSection

    section.grid
      DemoQuestsPanel
      DemoInfiniteQueryPanel
      DemoRealtimePanel

    DemoAdminPanel
    DemoCursorsPanel
</template>

<script setup lang="ts">
const demo = useDemoStore()
</script>
