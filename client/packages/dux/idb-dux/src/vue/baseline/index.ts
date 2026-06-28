// The internal baseline surface — consumed only by the overlay and the parity
// harness, never re-exported from `/vue`. See UPSTREAM.md.
export { SignedIn, SignedOut } from './components/auth.js'
export { Cursor } from './components/Cursor.js'
export { Cursors } from './components/Cursors.js'
export { IdbDuxDatabase, init } from './IdbDuxDatabase.js'
export type { UseAuthReturn, UseQueryReturn } from './IdbDuxDatabase.js'
export {
  IdbDuxRoom,
  rooms,
  usePresence,
  usePublishTopic,
  useSyncPresence,
  useTopicEffect,
  useTypingIndicator,
} from './IdbDuxRoom.js'
export type {
  PresenceHandle,
  TypingIndicatorHandle,
  TypingIndicatorOpts,
} from './IdbDuxRoom.js'
export { useInfiniteQuery } from './useInfiniteQuery.js'
export type { InfiniteQueryResult } from './useInfiniteQuery.js'
export { isClient, tryOnScopeDispose } from './utils.js'
