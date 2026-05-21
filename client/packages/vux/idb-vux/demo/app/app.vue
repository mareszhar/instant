<template lang="pug">
main.app-shell.page
  //- PanelIntro(
  //-   :app-id="access.appId"
  //-   :connection-label="access.connectionLabel"
  //-   :local-id-label="access.localIdLabel"
  //- )
  SandboxPanelIntro

  //- PanelMissingConfig(v-if="!access.hasDatabase")
  SandboxPanelMissingConfig(v-if="!useRuntimeConfig().public.instantAppId")

  template(v-else)
    //- PanelAccess
    SandboxPanelAccess

    section.card(v-if="access.isSignedIn && !access.activeWorkspaceId")
      h3 Pick a Workspace
      p.muted Create a workspace or join one with an invite code to unlock the rest of the demo.

    template(v-if="access.activeWorkspaceId")
      section.grid
        //- PanelTasks(
        //-   :key="`tasks-${access.activeWorkspaceId}`"
        //-   :workspace-id="access.activeWorkspaceId"
        //-   :signed-in-user-id="access.signedInUserId"
        //- )
        SandboxPanelTasks
        PanelInfiniteTasks(
          :key="`infinite-${access.activeWorkspaceId}`"
          :workspace-id="access.activeWorkspaceId"
        )

      section.grid
        PanelRealtime(
          :key="`realtime-${access.activeWorkspaceId}`"
          :workspace-id="access.activeWorkspaceId"
          :user-label="access.signedInLabel"
        )
        PanelAdmin(
          :key="`admin-${access.activeWorkspaceId}`"
          :workspace-id="access.activeWorkspaceId"
        )

      PanelCursors(
        :key="`cursor-${access.activeWorkspaceId}`"
        :workspace-id="access.activeWorkspaceId"
      )
</template>

<script setup lang="ts">
// const { auth } = useIdb()
const access = useAccessComp()
</script>

<style lang="stylus">
@require '/assets/styles/main.styl'
</style>
