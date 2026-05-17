<template lang="pug">
main.app-shell.page
  IntroPanel(
    :app-id="access.appId"
    :connection-label="access.connectionLabel"
    :local-id-label="access.localIdLabel"
  )

  MissingConfigPanel(v-if="!access.hasDatabase")

  template(v-else)
    //- AccessPanel
    SandboxAccessPanel

    section.card(v-if="access.isSignedIn && !access.activeWorkspaceId")
      h3 Pick a Workspace
      p.muted Create a workspace or join one with an invite code to unlock the rest of the demo.

    template(v-if="access.activeWorkspaceId")
      section.grid
        TasksPanel(
          :key="`tasks-${access.activeWorkspaceId}`"
          :workspace-id="access.activeWorkspaceId"
          :signed-in-user-id="access.signedInUserId"
        )
        InfiniteTasksPanel(
          :key="`infinite-${access.activeWorkspaceId}`"
          :workspace-id="access.activeWorkspaceId"
        )

      section.grid
        RealtimePanel(
          :key="`realtime-${access.activeWorkspaceId}`"
          :workspace-id="access.activeWorkspaceId"
          :user-label="access.signedInLabel"
        )
        AdminPanel(
          :key="`admin-${access.activeWorkspaceId}`"
          :workspace-id="access.activeWorkspaceId"
        )

      CursorsPanel(
        :key="`cursor-${access.activeWorkspaceId}`"
        :workspace-id="access.activeWorkspaceId"
      )
</template>

<script setup lang="ts">
const access = useAccess()
</script>

<style lang="stylus">
@require '/assets/styles/main.styl'
</style>
