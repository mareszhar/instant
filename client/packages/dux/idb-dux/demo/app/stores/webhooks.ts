export const useWebhooks = defineStore('webhooks', () => {
  const { db } = useIdb()
  const workspaces = useWorkspaces()

  const form = reactive({
    isProcessing: false,
    feedback: useEphemeralFeedback(),
  })

  const subscription = ref<InternalApi['/api/webhooks']['get'] | null>(null)

  const _refresh = async () => {
    const next = await $fetch('/api/webhooks')
    subscription.value = next
    if (next.warning)
      throw new Error(next.warning)
  }

  const refresh = () => executeFormAction(form, false, _refresh)

  // Deliveries flow back through Instant, scoped to the active workspace by the
  // same membership perms the rest of the demo uses — so one visitor never sees
  // another's. Persisted server-side, so they survive serverless cold starts.
  const { isLoading, error, webhookEvents: deliveries } = db.useQuery(() => q({
    webhookEvents: {
      $: {
        where: { workspace: workspaces.current?.id ?? $skip },
        order: { receivedAt: 'desc' },
        limit: 20,
      },
    },
  }))

  return {
    form,
    subscription,
    refresh,
    isLoading,
    error,
    deliveries,
  }
})
