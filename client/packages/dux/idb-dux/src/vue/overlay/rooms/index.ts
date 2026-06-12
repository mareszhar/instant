/**
 * The rooms overlay: the baseline room hooks keep their official names and
 * semantics; the stateful ones (`usePresence`, `useTypingIndicator`) gain the
 * result pattern, the rest pass through unchanged ([dux-spec-vue.md §6]).
 */
import {
  usePresence as baselineUsePresence,
  useTypingIndicator as baselineUseTypingIndicator,
  usePublishTopic,
  useSyncPresence,
  useTopicEffect,
} from '../../baseline/index.js'
import { makeResult } from '../result.js'

function usePresence(...args: Parameters<typeof baselineUsePresence>) {
  const handle = baselineUsePresence(...args) as any
  const { peers, isLoading, user, error, publishPresence } = handle
  return Object.assign(makeResult({ peers, isLoading, user, error }), { publishPresence })
}

function useTypingIndicator(...args: Parameters<typeof baselineUseTypingIndicator>) {
  const { active, setActive, inputProps } = baselineUseTypingIndicator(...args)
  return Object.assign(makeResult({ active }), { setActive, inputProps })
}

export const rooms = {
  useTopicEffect,
  usePublishTopic,
  usePresence,
  useSyncPresence,
  useTypingIndicator,
}
