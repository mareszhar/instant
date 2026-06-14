/**
 * The rooms overlay: the baseline room hooks keep their official names and
 * semantics; the stateful ones (`usePresence`, `useTypingIndicator`) gain the
 * result pattern, the rest pass through unchanged ([dux-spec-vue.md §6]).
 *
 * The wrappers re-declare the baseline generics rather than forwarding
 * `Parameters<typeof …>`: a spread-args signature collapses the generics to
 * their constraints, which erases per-room presence/topic typing (`keys` and
 * `peers` resolve against `never`). Re-declaring keeps `keys`,
 * `initialPresence`, and the resulting `peers`/`active` typed against the
 * room's schema.
 */
import type { PresenceOpts, RoomSchemaShape } from '@instantdb/core'
import type { InstantDuxRoom, TypingIndicatorOpts } from '../../baseline/index.js'
import {
  usePresence as baselineUsePresence,
  useTypingIndicator as baselineUseTypingIndicator,
  usePublishTopic,
  useSyncPresence,
  useTopicEffect,
} from '../../baseline/index.js'
import { makeResult } from '../result.js'

function usePresence<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
  Keys extends keyof RoomSchema[RoomType]['presence'],
>(
  room: InstantDuxRoom<any, RoomSchema, RoomType>,
  opts?: PresenceOpts<RoomSchema[RoomType]['presence'], Keys>,
) {
  const handle = baselineUsePresence(room, opts)
  // user/error are optional on the presence-response shape, but the baseline
  // always creates their refs; assert them present for the result bag.
  return Object.assign(
    makeResult({
      peers: handle.peers,
      isLoading: handle.isLoading,
      user: handle.user!,
      error: handle.error!,
    }),
    { publishPresence: handle.publishPresence },
  )
}

function useTypingIndicator<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
>(
  room: InstantDuxRoom<any, RoomSchema, RoomType>,
  inputName: string,
  opts?: TypingIndicatorOpts,
) {
  const { active, setActive, inputProps } = baselineUseTypingIndicator(room, inputName, opts)
  return Object.assign(makeResult({ active }), { setActive, inputProps })
}

export const rooms = {
  useTopicEffect,
  usePublishTopic,
  usePresence,
  useSyncPresence,
  useTypingIndicator,
}
