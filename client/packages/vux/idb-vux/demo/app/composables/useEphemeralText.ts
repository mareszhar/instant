export function useEphemeralText(message: Ref<string>, timeoutMs = 5000) {
  let timer: ReturnType<typeof setTimeout> | undefined

  const clearTimer = () => {
    clearTimeout(timer)
    timer = undefined
  }

  watch(message, (nextValue) => {
    clearTimer()

    if (!nextValue)
      return

    timer = setTimeout(() => {
      if (message.value === nextValue)
        message.value = ''
      timer = undefined
    }, timeoutMs)
  })

  onBeforeUnmount(clearTimer)
}
