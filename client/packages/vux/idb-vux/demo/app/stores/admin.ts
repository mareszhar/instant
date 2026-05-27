export const admin = defineStore('admin', () => {
  const form = reactive({
    isProcessing: false,
    feedback: useEphemeralFeedback(),
  })

  return {
    form,
  }
})
