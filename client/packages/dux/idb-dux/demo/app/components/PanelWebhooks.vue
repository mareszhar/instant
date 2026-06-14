<template lang="pug">
article.card
  .stack
    h3 Webhooks (manager + handler route)
    p.muted.
      Subscriptions are managed via #[code adminDb.webhooks.manager]; deliveries land on
      this app's #[code defineWebhookHandler] route. Instant only posts to a #[strong public]
      URL, so on localhost subscribe with a tunnel (e.g. #[code ngrok http 3000]) origin.

  form.stack(@submit.prevent="webhooks.create(receiverUrl)")
    label.field
      span Receiver URL
      input.input(
        v-model.trim="receiverUrl"
        type="url"
        placeholder="https://your-tunnel.example/api/webhooks/receive"
      )
    .row
      button.btn(
        type="submit"
        :disabled="!receiverUrl || webhooks.form.isProcessing"
      ) Subscribe
      button.btn.secondary(
        type="button"
        :disabled="webhooks.form.isProcessing"
        @click="webhooks.refresh"
      ) Refresh

  p.alert(v-if="webhooks.form.feedback" :class="webhooks.form.feedback.tone") {{ webhooks.form.feedback.text }}

  .stack(v-if="overview?.webhooks.length")
    h4 Subscriptions
    ul.task-list
      li(v-for="webhook in overview.webhooks" :key="webhook.id")
        .workspace
          .workspace__main
            p.title {{ webhook.sink.url }}
            p.muted {{ webhook.namespaces.join(', ') }} · {{ webhook.actions.join(', ') }}
          .workspace__controls
            button.btn.danger.compact(
              type="button"
              :disabled="webhooks.form.isProcessing"
              @click="webhooks.remove(webhook.id)"
            ) Delete
  p.muted(v-else-if="overview") No webhook subscriptions yet.

  .stack(v-if="overview?.recentChanges.length")
    h4 Recent deliveries
    ul.task-list.demo-reaction-list
      li.demo-reaction-item(v-for="change in overview.recentChanges" :key="change.at")
        span.badge {{ change.namespace }}.{{ change.action }}
        span.demo-reaction-sender {{ change.summary }}
</template>

<script setup lang="ts">
const webhooks = useWebhooks()
const overview = computed(() => webhooks.overview)

// Prefill the app's own receiver origin — swap in a tunnel/deploy origin to
// actually subscribe (localhost is rejected by Instant).
const receiverUrl = ref('')

onMounted(() => {
  receiverUrl.value = `${window.location.origin}/api/webhooks/receive`
  webhooks.refresh()
})
</script>
