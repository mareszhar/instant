<template lang="pug">
template(v-if="proxySafeDb")
  SignedOut(:db="proxySafeDb")
    section.panel.auth
      h2 Signed Out
      p Use guest sign-in for quick verification, or use magic codes.
      .auth-actions
        button(:disabled="demo.isAuthenticating" @click="demo.signInAsGuest") Sign in as guest
      .divider
      form.auth-form(v-if="!demo.sentCodeEmailAddress" @submit.prevent="demo.requestMagicCode")
        label
          | Email
          input(v-model="demo.emailAddressInput" type="email" placeholder="you@example.com")
        button(:disabled="demo.isAuthenticating || !demo.emailAddressInput.trim()" type="submit") Send magic code
      form.auth-form(v-else @submit.prevent="demo.confirmMagicCode")
        p.muted Code sent to #[strong {{ demo.sentCodeEmailAddress }}]
        label
          | Verification code
          input(v-model="demo.magicCodeInput" type="text" placeholder="123456")
        button(:disabled="demo.isAuthenticating || !demo.magicCodeInput.trim()" type="submit") Verify code
        button.secondary(type="button" @click="demo.resetMagicCodeFlow") Use a different email
      p.error(v-if="demo.authErrorMessage") {{ demo.authErrorMessage }}

  SignedIn(:db="proxySafeDb")
    section.panel.auth.ok
      h2 Signed In
      p Logged in as #[strong {{ demo.signedInLabel || 'Unknown user' }}]
      p.muted(v-if="demo.signedInUserId") User ID: #[code {{ demo.signedInUserId }}]
      .auth-actions
        button.secondary(@click="demo.signOut") Sign out
</template>

<script setup lang="ts">
import { SignedIn, SignedOut } from '@mszr/idb-vux'

const demo = useDemoStore()
const db = useDb()
const proxySafeDb = db ? markRaw(db) : null
</script>
