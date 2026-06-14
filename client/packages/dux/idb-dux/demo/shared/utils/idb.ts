import type { IdbEntity, IdbQueryEntity } from '@mszr/idb-dux'

// Re-exported here so `q`, `$skip`, `$only`, and `id` are auto-imported across
// both /app and /server — the Nuxt /shared sweet spot.
export { $only, $skip, id, q } from '@mszr/idb-dux'
export type { IdbAuthUser as AuthUser } from '@mszr/idb-dux/vue'
export type { AppSchema } from '~~/config/instant.schema'

export type User = IdbEntity<'$users'>
export type Task = IdbEntity<'tasks'>
export type TaskWithAssignee = IdbQueryEntity<'tasks', { assignee: {} }>

export function userToLabel(
  user: AuthUser | User | null | undefined,
  authUser?: AuthUser | null | undefined,
) {
  if (user && authUser && user.id === authUser.id)
    return 'me'

  return user
    ? (user.email ?? `Guest-${user.id.slice(-6)}`)
    : 'unknown visitor'
}
