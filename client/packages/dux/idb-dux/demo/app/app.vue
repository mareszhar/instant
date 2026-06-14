<template lang="pug">
main.app-shell.page
  PanelIntro
  PanelMissingConfig(v-if="!useRuntimeConfig().public.instantAppId")

  template(v-else)
    PanelAccess

    section.card(v-if="auth.user && !workspaces.current")
      h3 Pick a Workspace
      p.muted Create a workspace or join one with an invite code to unlock the rest of the demo.

    template(v-if="workspaces.current")
      section.grid
        PanelTasks
        PanelInfiniteTasks

      section.grid
        PanelRoom
        PanelAdmin

      section.grid
        PanelWebhooks

      PanelCursors
</template>

<script setup lang="ts">
const { auth } = useIdb()
const workspaces = useWorkspaces()
</script>

<style lang="stylus">
@require '/assets/styles/main.styl'
</style>
