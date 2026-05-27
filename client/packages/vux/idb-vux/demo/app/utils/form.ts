export type FeedbackTone = 'success' | 'danger' | 'info'

export interface Feedback {
  text: string
  tone: FeedbackTone
}

export interface FormState {
  isProcessing: boolean
  feedback: Feedback | null
}

export async function executeFormAction(
  formState: FormState,
  shouldSkip: boolean,
  action: () => Promise<unknown>,
) {
  if (shouldSkip || formState.isProcessing)
    return

  formState.isProcessing = true
  formState.feedback = null

  const [error, successMsg] = await go(action())

  if (error)
    formState.feedback = { tone: 'danger', text: formatError(error) }
  else if (typeof successMsg === 'string')
    formState.feedback = { tone: 'success', text: successMsg }

  formState.isProcessing = false
}
