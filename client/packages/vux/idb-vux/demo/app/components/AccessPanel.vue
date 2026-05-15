<template lang="pug">
section.card.demo-access
  .stack
    h3 Access and Workspaces
    p.muted
      | Create or join a workspace to test multiplayer flows.
      | Data is scoped to your workspace code.

  p.alert(
    v-if="feedback"
    :class="feedback.tone"
  ) {{ feedback.text }}
  p.muted(v-else) {{ access.workspaceStatusText }}

  template(v-if="access.proxySafeDb")
    SignedOut(:db="access.proxySafeDb")
      .stack
        p.inline-pair
          span.label Status
          span.inline-value Signed out
        .row
          button.btn(
            type="button"
            :disabled="access.isAuthenticating"
            @click="access.signInAsGuest"
          ) Continue as guest

        form.stack(v-if="!access.sentCodeEmailAddress" @submit.prevent="access.requestMagicCode")
          label.field
            span Email
            input.input(
              v-model="access.emailAddress"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
            )
          button.btn(
            type="submit"
            :disabled="access.isAuthenticating || !access.emailAddress.trim()"
          ) Send magic code

        form.stack(v-else @submit.prevent="access.confirmMagicCode")
          p.inline-pair
            span.label Code Sent To
            span.inline-value {{ access.sentCodeEmailAddress }}
          label.field
            span Verification code
            input.input(
              v-model="access.magicCode"
              type="text"
              placeholder="123456"
              autocomplete="one-time-code"
            )
          .row
            button.btn(
              type="submit"
              :disabled="access.isAuthenticating || !access.magicCode.trim()"
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
            span.inline-value {{ access.signedInLabel || 'unknown user' }}
            button.btn.secondary.compact(type="button" @click="access.signOut") Sign out
        .stat(v-if="access.signedInUserId")
          span.label User ID
          span.inline-value {{ access.signedInUserId }}

      .demo-two-col
        form.stack(@submit.prevent="access.createWorkspace")
          h4 Create workspace
          label.field
            span Name
            input.input(
              v-model="access.workspaceName"
              type="text"
              placeholder="launch-lab"
              autocomplete="off"
            )
          button.btn(
            type="submit"
            :disabled="!access.canCreateWorkspace || access.isSavingWorkspace"
          ) Create

        form.stack(@submit.prevent="access.joinWorkspaceWithInviteCode")
          h4 Join workspace
          label.field
            span Invite code
            input.input(
              v-model="access.inviteCode"
              type="text"
              placeholder="ABCD1234"
              autocomplete="off"
            )
          button.btn(
            type="submit"
            :disabled="!access.canJoinWorkspace || access.isSavingWorkspace"
          ) Join

      .stack(v-if="access.workspaces.length")
        h4 Your workspaces
        ul.task-list.demo-workspace-list
          li(v-for="workspace in access.workspaces" :key="workspace.id")
            .workspace(:class="{ 'demo-workspace--active': workspace.id === access.activeWorkspaceId }")
              .workspace__main
                p.title {{ workspace.name }}
                p.muted {{ workspace.memberships.length }} member{{ workspace.memberships.length === 1 ? '' : 's' }}
              .workspace__controls
                .invite-group
                  code {{ workspace.inviteCode }}
                  button.btn.secondary.compact(
                    type="button"
                    @click="copyInviteCode(workspace.inviteCode)"
                  ) Copy
                button.btn.secondary.compact(
                  v-if="workspace.id !== access.activeWorkspaceId"
                  type="button"
                  @click="access.selectWorkspace(workspace.id)"
                ) Open
                button.btn.danger.compact(
                  type="button"
                  :disabled="access.isDeletingWorkspace"
                  @click="access.deleteWorkspace(workspace.id)"
                ) Delete
</template>

<script setup lang="ts">
import { SignedIn, SignedOut } from '@mszr/idb-vux'

const access = useAccess()
const copyMessage = ref('')
const copyMessageTone = ref<'success' | 'danger'>('success')
const { copy } = useClipboard()

useEphemeralText(copyMessage)
useEphemeralText(toRef(access, 'accessMessage'))

const feedback = computed(() => {
  if (access.accessError || access.authError)
    return { tone: 'danger', text: access.authError }

  if (copyMessage.value)
    return { tone: copyMessageTone.value, text: copyMessage.value }

  if (access.accessMessage)
    return { tone: 'success', text: access.accessMessage }

  return null
})

async function copyInviteCode(inviteCode: string): Promise<void> {
  try {
    await copy(inviteCode)
    copyMessage.value = `Invite code ${inviteCode} copied.`
    copyMessageTone.value = 'success'
  }
  catch {
    copyMessage.value = 'Copy failed. Please copy manually.'
    copyMessageTone.value = 'danger'
  }
}
</script>
