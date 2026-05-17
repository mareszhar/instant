<template lang="pug">
section.card.demo-access
  .stack
    h3 Access and Workspaces
    p.muted.
      Create or join a workspace to test multiplayer flows.
      Data is scoped to your workspace code.

  p.alert(v-if="feedback" :class="feedback.tone") {{ feedback.text }}
  p.muted(v-else)
    template(v-if="!access.auth.user?.id") Sign in to create or join a workspace.
    template(v-else-if="workspaces.queryIsLoading") Loading workspaces...
    template(v-else-if="workspaces.queryError") Error loading workspaces: {{ formatError(workspaces.queryError) }}
    template(v-else-if="!workspaces.availableWorkspaces.length") No workspaces found. Create or join a workspace to continue.
    template(v-else) {{ workspaces.availableWorkspaces.length }} workspace{{ workspaces.availableWorkspaces.length === 1 ? '' : 's' }} available.

  SignedOut(:db="access.proxySafeDb")
    .stack
      p.inline-pair #[span.label Status] #[span.inline-value Signed out]
      .row
        button.btn(
          type="button"
          :disabled="access.form.isProcessing"
          @click="access.signInAsGuest"
        ) Continue as guest

      form.stack(v-if="!access.form.isMagicCodeRequested" @submit.prevent="access.requestMagicCode")
        label.field
          span Email
          input.input(
            v-model.trim="access.form.email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
          )
        button.btn(
          type="submit"
          :disabled="!access.form.email || access.form.isProcessing"
        ) Send magic code

      form.stack(v-else @submit.prevent="access.confirmMagicCode")
        p.inline-pair #[span.label Code Sent To] #[span.inline-value {{ access.form.email }}]
        label.field
          span Verification code
          input.input(
            v-model.trim="access.form.magicCode"
            type="text"
            placeholder="123456"
          )
        .row
          button.btn(
            type="submit"
            :disabled="!access.form.magicCode || access.form.isProcessing"
          ) Verify
          button.btn.secondary(
            type="button"
            @click="access.resetMagicCodeFlow"
          ) Use another email

  SignedIn(:db="access.proxySafeDb")
    .stats.demo-auth-stats
      .stat
        span.label Signed In As
        .demo-auth-row
          span.inline-value {{ access.userLabel || 'unknown user' }}
          button.btn.secondary.compact(type="button" @click="access.signOut") Sign out
      .stat(v-if="access.auth.user?.id")
        span.label User ID
        span.inline-value {{ access.auth.user.id }}

    .demo-two-col
      form.stack(@submit.prevent="workspaces.createWorkspace")
        h4 Create workspace
        label.field
          span Name
          input.input(
            v-model.trim="workspaces.form.name"
            type="text"
            placeholder="launch-lab"
            autocomplete="off"
          )
        button.btn(
          type="submit"
          :disabled="!workspaces.form.name || workspaces.form.isProcessing"
        ) Create

      form.stack(@submit.prevent="workspaces.joinWorkspace")
        h4 Join workspace
        label.field
          span Invite code
          input.input(
            v-model.trim="workspaces.form.inviteCode"
            type="text"
            placeholder="ABCD1234"
            autocomplete="off"
          )
        button.btn(
          type="submit"
          :disabled="!workspaces.form.inviteCode || workspaces.form.isProcessing"
        ) Join

    .stack(v-if="workspaces.availableWorkspaces.length")
      h4 Your workspaces
      ul.task-list.demo-workspace-list
        li(v-for="workspace in workspaces.availableWorkspaces" :key="workspace.id")
          .workspace(:class="{ 'demo-workspace--active': workspace.id === workspaces.current?.id }")
            .workspace__main
              p.title {{ workspace.name }}
              p.muted {{ workspace.memberships.length }} member{{ workspace.memberships.length === 1 ? '' : 's' }}
            .workspace__controls
              .invite-group
                code {{ workspace.inviteCode }}
                button.btn.secondary.compact(
                  type="button"
                  @click="workspaces.copyInviteCode(workspace.inviteCode)"
                ) Copy
              button.btn.secondary.compact(
                v-if="workspace.id !== workspaces.current?.id"
                type="button"
                @click="workspaces.requestWorkspace(workspace.inviteCode)"
              ) Open
              button.btn.danger.compact(
                type="button"
                :disabled="workspaces.form.isProcessing"
                @click="workspaces.deleteWorkspace(workspace.id)"
              ) Delete
</template>

<script setup lang="ts">
import { SignedIn, SignedOut } from '@mszr/idb-vux'

const access = useAccessStore()
const workspaces = useWorkspacesStore()

const feedback = computed(() => {
  return access.form.feedback ?? workspaces.form.feedback ?? workspaces.copyingFeedback
})
</script>
