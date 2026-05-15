import type { AppSchema } from '~~/config/instant.schema'
import { defineQuery } from '@mszr/idb-vux'

export type {
  ConnectionStatus,
  InstantVuxDatabase,
  InstaQLEntity,
} from '@mszr/idb-vux'

export type { AppSchema }

export { id, lookup } from '@mszr/idb-vux'
export const q = defineQuery<AppSchema>()

export function createInviteCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const chars = Array.from({ length }, () => {
    const index = Math.floor(Math.random() * alphabet.length)
    return alphabet[index]
  })
  return chars.join('')
}

export function formatError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Unexpected error'
  }

  const maybe = error as { body?: { message?: string }, message?: string }
  return maybe.body?.message ?? maybe.message ?? 'Unexpected error'
}

export function toConnectionLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'authenticated':
      return 'connected'
    case 'connecting':
    case 'opened':
      return 'authenticating'
    case 'closed':
      return 'disconnected'
    case 'errored':
      return 'error'
    default:
      return status
  }
}
