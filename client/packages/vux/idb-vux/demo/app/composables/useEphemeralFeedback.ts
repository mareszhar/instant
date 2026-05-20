const DEFAULT_FEEDBACK_TIMEOUT_MS = 5000

export function useEphemeralFeedback(timeoutMs = DEFAULT_FEEDBACK_TIMEOUT_MS) {
  return refAutoReset<Feedback | null>(null, timeoutMs)
}
