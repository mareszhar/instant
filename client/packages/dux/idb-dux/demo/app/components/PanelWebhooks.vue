<template lang="pug">
article.card
  .stack
    h3 Webhooks (handler route + manager)
    p.muted.
      One app-owned subscription (provisioned via #[code adminDb.webhooks.manager]
      by a maintainer) posts task changes to this app's #[code defineWebhookHandler]
      route. Each delivery is journaled to its workspace, so the feed below is
      scoped to #[strong this] workspace — your activity, not anyone else's.

  .row
    button.btn.secondary(
      type="button"
      :disabled="webhooks.form.isProcessing"
      @click="webhooks.refresh"
    ) Refresh subscription

  p.alert(v-if="webhooks.form.feedback" :class="webhooks.form.feedback.tone") {{ webhooks.form.feedback.text }}

  .stack(v-if="subscription?.subscriptions.length")
    h4 Subscription
    ul.task-list
      li(v-for="sub in subscription.subscriptions" :key="sub.url")
        .workspace
          .workspace__main
            p.title {{ sub.url }}
            p.muted {{ sub.namespaces.join(', ') }} · {{ sub.actions.join(', ') }}
          span.badge {{ sub.status }}
  p.muted(v-else-if="subscription").
    No app webhook provisioned yet — run #[code bun run webhook:ensure &lt;receiver-url&gt;]
    against the deployed (or tunneled) origin.

  .stack
    h4 Recent deliveries (this workspace)
    p.muted(v-if="webhooks.isLoading") Loading deliveries…
    ul.task-list.demo-reaction-list(v-else-if="webhooks.deliveries.length")
      li.demo-reaction-item(v-for="delivery in webhooks.deliveries" :key="delivery.id")
        span.badge {{ delivery.namespace }}.{{ delivery.action }}
        span.demo-reaction-sender {{ delivery.summary }}
    p.muted(v-else) No deliveries yet — add, complete, or delete a task to see one land.
</template>

<script setup lang="ts">
const webhooks = useWebhooks()
const subscription = computed(() => webhooks.subscription)

onMounted(() => {
  webhooks.refresh()
})
</script>
