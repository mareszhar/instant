// The internal baseline surface — consumed only by the overlay and the parity
// harness, never re-exported from `/vue`. See UPSTREAM.md.
export { SignedIn, SignedOut } from './components/auth.js'
export { Cursor } from './components/Cursor.js'
export { Cursors } from './components/Cursors.js'
export { init, InstantDuxDatabase } from './InstantDuxDatabase.js'
export type { UseAuthReturn, UseQueryReturn } from './InstantDuxDatabase.js'
export {
  InstantDuxRoom,
  rooms,
  usePresence,
  usePublishTopic,
  useSyncPresence,
  useTopicEffect,
  useTypingIndicator,
} from './InstantDuxRoom.js'
export type {
  PresenceHandle,
  TypingIndicatorHandle,
  TypingIndicatorOpts,
} from './InstantDuxRoom.js'
export { useInfiniteQuery } from './useInfiniteQuery.js'
export type { InfiniteQueryResult } from './useInfiniteQuery.js'
export { isClient, tryOnScopeDispose } from './utils.js'
