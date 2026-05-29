import { defineQuery } from '@mszr/idb-vux'

export type { User as AuthUser, InstaQLEntity } from '@mszr/idb-vux'
export { id, lookup } from '@mszr/idb-vux'
export type User = InstaQLEntity<AppSchema, '$users'>
export type Task = InstaQLEntity<AppSchema, 'tasks'>
export type TaskWithAssignee = InstaQLEntity<AppSchema, 'tasks', { assignee: {} }>
export type { AppSchema } from '~~/config/instant.schema'

export const q = defineQuery<AppSchema>()
export const $skip = undefined

export function userToLabel(user: AuthUser | User | null | undefined, authUser?: AuthUser | null | undefined) {
  if (user && authUser && user.id === authUser.id)
    return 'me'

  return user
    ? (user.email ?? `Guest-${user.id.slice(-6)}`)
    : 'unknown visitor'
}
