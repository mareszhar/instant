export const useMismatchStore = defineStore('mismatch', () => {
  const name = ref('yugi')
  const greeting = computed(() => `hi ${name.value}, it's ${Date.now()}`)

  return {
    name,
    greeting,
  }
})
