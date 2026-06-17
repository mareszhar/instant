export { go } from 'go-go-try'
export type { InternalApi } from 'nitropack'
export * as R from 'remeda'

export function formatError(error: unknown): string {
  if (!error || typeof error !== 'object')
    return 'Unexpected error'

  const maybe = error as { body?: { message?: string }, message?: string }
  return maybe.body?.message ?? maybe.message ?? 'Unexpected error'
}
