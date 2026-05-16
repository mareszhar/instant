import type {
  InstantCoreDatabase,
  InstantSchemaDef,
  PresenceOpts,
  PresenceResponse,
  RoomSchemaShape,
} from '@instantdb/core'
import type {
  ComputedRef,
  MaybeRefOrGetter,
  Ref,
  ShallowRef,
} from 'vue'
import type { StateFromRefs, XResult } from './xResult.js'
import {
  getCurrentScope,
  onScopeDispose,
  shallowRef,
  toValue,
  watchEffect,
} from 'vue'
import { createXResult } from './xResult.js'

function isServerRuntime() {
  return typeof window === 'undefined'
}

function hasRoomReactor(room: { core: unknown } | null | undefined) {
  const reactor = (room as any)?.core?._reactor

  return Boolean(
    reactor
    && reactor.querySubs
    && typeof reactor.querySubs.updateInPlace === 'function'
    && reactor.kv
    && typeof reactor.kv.updateInPlace === 'function'
    && typeof reactor.getPresence === 'function'
    && typeof reactor.subscribeTopic === 'function'
    && typeof reactor.subscribePresence === 'function'
    && typeof reactor.joinRoom === 'function'
    && typeof reactor.publishPresence === 'function'
    && typeof reactor.publishTopic === 'function',
  )
}

function attachScopeCleanup(cleanup: () => void) {
  if (getCurrentScope()) {
    onScopeDispose(cleanup)
  }
}

// ------
// Types

export type PresenceHandle<
  PresenceShape,
  Keys extends keyof PresenceShape,
> = {
  [K in keyof PresenceResponse<PresenceShape, Keys>]: ShallowRef<
    PresenceResponse<PresenceShape, Keys>[K]
  >
} & {
  publishPresence: (data: Partial<PresenceShape>) => void
}

export type UsePresenceXRefs<
  PresenceShape,
  Keys extends keyof PresenceShape,
> = PresenceHandle<PresenceShape, Keys>

export type UsePresenceXState<
  PresenceShape,
  Keys extends keyof PresenceShape,
> = StateFromRefs<UsePresenceXRefs<PresenceShape, Keys>>

export type UsePresenceXResult<
  PresenceShape,
  Keys extends keyof PresenceShape,
> = XResult<
  UsePresenceXRefs<PresenceShape, Keys>,
  UsePresenceXState<PresenceShape, Keys>
>

export interface TypingIndicatorOpts {
  timeout?: number | null
  stopOnEnter?: boolean
  writeOnly?: boolean
}

export interface TypingIndicatorHandle<PresenceShape> {
  active: Ref<PresenceShape[]>
  setActive: (active: boolean) => void
  inputProps: {
    /**
     * Listener key is lowercased so Vue's v-bind spread maps it to the native
     * `keydown` event instead of a non-existent `key-down` listener.
     */
    onKeydown: (e: KeyboardEvent) => void
    onBlur: () => void
  }
}

export type UseTypingIndicatorXRefs<PresenceShape>
  = TypingIndicatorHandle<PresenceShape>

export type UseTypingIndicatorXState<PresenceShape>
  = StateFromRefs<UseTypingIndicatorXRefs<PresenceShape>>

export type UseTypingIndicatorXResult<PresenceShape>
  = XResult<
    UseTypingIndicatorXRefs<PresenceShape>,
    UseTypingIndicatorXState<PresenceShape>
  >

export const defaultActivityStopTimeout = 1_000

// ------
// Topics

export function useTopicEffect<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
  TopicType extends keyof RoomSchema[RoomType]['topics'],
>(
  room: InstantVuxRoom<any, RoomSchema, RoomType>,
  topic: TopicType,
  onEvent: (
    event: RoomSchema[RoomType]['topics'][TopicType],
    peer: RoomSchema[RoomType]['presence'],
  ) => any,
): void {
  if (isServerRuntime() || !hasRoomReactor(room)) {
    return
  }

  const stop = watchEffect((onCleanup) => {
    const roomType = toValue(room.type)
    const roomId = toValue(room.id)

    const unsub = room.core._reactor.subscribeTopic(
      roomType,
      roomId,
      topic,
      (event: any, peer: any) => {
        onEvent(event, peer)
      },
    )

    onCleanup(unsub)
  })

  attachScopeCleanup(stop)
}

export function usePublishTopic<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
  TopicType extends keyof RoomSchema[RoomType]['topics'],
>(
  room: InstantVuxRoom<any, RoomSchema, RoomType>,
  topic: TopicType,
): (data: RoomSchema[RoomType]['topics'][TopicType]) => void {
  if (isServerRuntime() || !hasRoomReactor(room)) {
    return () => {}
  }

  const stop = watchEffect((onCleanup) => {
    const roomType = toValue(room.type)
    const roomId = toValue(room.id)
    const unsub = room.core._reactor.joinRoom(roomType as string, roomId)
    onCleanup(unsub)
  })

  attachScopeCleanup(stop)

  return (data: RoomSchema[RoomType]['topics'][TopicType]) => {
    room.core._reactor.publishTopic({
      roomType: toValue(room.type),
      roomId: toValue(room.id),
      topic,
      data,
    })
  }
}

// ---------
// Presence

export function usePresence<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
  Keys extends keyof RoomSchema[RoomType]['presence'],
>(
  room: InstantVuxRoom<any, RoomSchema, RoomType>,
  opts: PresenceOpts<RoomSchema[RoomType]['presence'], Keys> = {},
): PresenceHandle<RoomSchema[RoomType]['presence'], Keys> {
  const initial = hasRoomReactor(room)
    ? ((room.core._reactor.getPresence(
        toValue(room.type),
        toValue(room.id),
        opts,
      ) ?? {
        peers: {},
        isLoading: true,
      }) as PresenceResponse<RoomSchema[RoomType]['presence'], Keys>)
    : ({
        peers: {},
        isLoading: true,
      } as PresenceResponse<RoomSchema[RoomType]['presence'], Keys>)

  const peers = shallowRef(initial.peers)
  const isLoading = shallowRef(initial.isLoading)
  const user = shallowRef<any>((initial as any).user)
  const error = shallowRef<any>((initial as any).error)

  const publishPresence = (data: Partial<RoomSchema[RoomType]['presence']>) => {
    if (isServerRuntime() || !hasRoomReactor(room)) {
      return
    }

    room.core._reactor.publishPresence(
      toValue(room.type),
      toValue(room.id),
      data,
    )
  }

  if (isServerRuntime() || !hasRoomReactor(room)) {
    return {
      peers,
      isLoading,
      user,
      error,
      publishPresence,
    } as PresenceHandle<RoomSchema[RoomType]['presence'], Keys>
  }

  const stop = watchEffect((onCleanup) => {
    const roomType = toValue(room.type)
    const roomId = toValue(room.id)
    const unsub = room.core._reactor.subscribePresence(
      roomType,
      roomId,
      opts,
      (data: any) => {
        peers.value = data.peers
        isLoading.value = data.isLoading
        if ('user' in data) {
          user.value = data.user
        }
        if ('error' in data) {
          error.value = data.error
        }
      },
    )

    onCleanup(unsub)
  })

  attachScopeCleanup(stop)

  return {
    peers,
    isLoading,
    user,
    error,
    publishPresence,
  } as PresenceHandle<RoomSchema[RoomType]['presence'], Keys>
}

export function usePresenceX<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
  Keys extends keyof RoomSchema[RoomType]['presence'],
>(
  room: InstantVuxRoom<any, RoomSchema, RoomType>,
  opts: PresenceOpts<RoomSchema[RoomType]['presence'], Keys> = {},
): UsePresenceXResult<RoomSchema[RoomType]['presence'], Keys> {
  const refs = usePresence(room, opts)
  return createXResult(refs)
}

export function useSyncPresence<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
>(
  room: InstantVuxRoom<any, RoomSchema, RoomType>,
  data: MaybeRefOrGetter<Partial<RoomSchema[RoomType]['presence']>>,
): void {
  if (isServerRuntime() || !hasRoomReactor(room)) {
    return
  }

  const joinStop = watchEffect((onCleanup) => {
    const roomType = toValue(room.type) as string
    const roomId = toValue(room.id)
    const unsub = room.core._reactor.joinRoom(roomType, roomId, toValue(data))
    onCleanup(unsub)
  })

  attachScopeCleanup(joinStop)

  const syncStop = watchEffect(() => {
    room.core._reactor.publishPresence(
      toValue(room.type),
      toValue(room.id),
      toValue(data),
    )
  })

  attachScopeCleanup(syncStop)
}

// -----------------
// Typing indicator

export function useTypingIndicator<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
>(
  room: InstantVuxRoom<any, RoomSchema, RoomType>,
  inputName: string,
  opts: TypingIndicatorOpts = {},
): TypingIndicatorHandle<RoomSchema[RoomType]['presence']> {
  const active = shallowRef<RoomSchema[RoomType]['presence'][]>([])

  if (isServerRuntime() || !hasRoomReactor(room)) {
    return {
      active,
      setActive() {},
      inputProps: {
        onKeydown() {},
        onBlur() {},
      },
    }
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const presence = usePresence(room, {
    keys: [inputName] as (keyof RoomSchema[RoomType]['presence'])[],
  })

  const activeStop = watchEffect(() => {
    if (opts?.writeOnly) {
      active.value = []
      return
    }

    // Track peers so we re-run when presence updates
    void presence.peers.value
    const snapshot = room.core._reactor.getPresence(
      toValue(room.type),
      toValue(room.id),
    )
    active.value = Object.values(snapshot?.peers ?? {}).filter(
      (peer: any) => peer[inputName] === true,
    )
  })

  attachScopeCleanup(activeStop)

  const setActive = (isActive: boolean) => {
    room.core._reactor.publishPresence(toValue(room.type), toValue(room.id), {
      [inputName]: isActive ? true : null,
    } as Partial<RoomSchema[RoomType]['presence']>)

    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    if (!isActive) {
      return
    }

    if (opts?.timeout === null || opts?.timeout === 0) {
      return
    }

    timeoutId = setTimeout(() => {
      room.core._reactor.publishPresence(toValue(room.type), toValue(room.id), {
        [inputName]: null,
      } as Partial<RoomSchema[RoomType]['presence']>)
    }, opts?.timeout ?? defaultActivityStopTimeout)
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // Clear sticky typing state on dispose, including timeout-disabled modes.
      setActive(false)
    })
  }

  const onKeydown = (event: KeyboardEvent) => {
    const shouldStop = opts?.stopOnEnter && event.key === 'Enter'
    setActive(!shouldStop)
  }

  const onBlur = () => {
    setActive(false)
  }

  return {
    active,
    setActive,
    inputProps: { onKeydown, onBlur },
  }
}

export function useTypingIndicatorX<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
>(
  room: InstantVuxRoom<any, RoomSchema, RoomType>,
  inputName: string,
  opts: TypingIndicatorOpts = {},
): UseTypingIndicatorXResult<RoomSchema[RoomType]['presence']> {
  const refs = useTypingIndicator(room, inputName, opts)
  return createXResult(refs)
}

// --------------
// Hooks namespace

export const rooms = {
  useTopicEffect,
  usePublishTopic,
  usePresence,
  usePresenceX,
  useSyncPresence,
  useTypingIndicator,
  useTypingIndicatorX,
}

// ------------
// Class

export class InstantVuxRoom<
  Schema extends InstantSchemaDef<any, any, any>,
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
> {
  core: InstantCoreDatabase<Schema, boolean>
  type: ComputedRef<RoomType> | RoomType
  id: ComputedRef<string> | string

  constructor(
    core: InstantCoreDatabase<Schema, boolean>,
    type: ComputedRef<RoomType> | RoomType,
    id: ComputedRef<string> | string,
  ) {
    this.core = core
    this.type = type
    this.id = id
  }
}
