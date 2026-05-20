export type FeedbackTone = 'success' | 'danger' | 'info'

export interface Feedback {
  text: string
  tone: FeedbackTone
}

export function formatError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Unexpected error'
  }

  const maybe = error as { body?: { message?: string }, message?: string }
  return maybe.body?.message ?? maybe.message ?? 'Unexpected error'
}
