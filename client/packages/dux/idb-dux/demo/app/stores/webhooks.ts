export const useWebhooks = defineStore('webhooks', () => {
  const form = reactive({
    isProcessing: false,
    feedback: useEphemeralFeedback(),
  })

  const overview = ref<InternalApi['/api/webhooks']['get'] | null>(null)

  const _refresh = async () => {
    const next = await $fetch('/api/webhooks')
    overview.value = next
    if (next.warning)
      throw new Error(next.warning)
  }

  const refresh = () => executeFormAction(form, false, _refresh)

  const create = (url: string) => executeFormAction(form, !url, async () => {
    const response = await $fetch('/api/webhooks', { method: 'POST', body: { url } })
    if (!response.ok)
      throw new Error(response.warning ?? 'Failed to create webhook')

    await _refresh()
    return 'Webhook subscription created.'
  })

  const remove = (webhookId: string) => executeFormAction(form, false, async () => {
    // The path is parameterized and sits beside the static `receive` route, so
    // Nitro can't infer the response shape from the literal — state it.
    const response = await $fetch<InternalApi['/api/webhooks/:webhookId']['delete']>(
      `/api/webhooks/${webhookId}`,
      { method: 'DELETE' },
    )
    if (!response.ok)
      throw new Error(response.warning ?? 'Failed to delete webhook')

    await _refresh()
    return 'Webhook subscription deleted.'
  })

  return {
    form,
    overview,
    refresh,
    create,
    remove,
  }
})
