import type {
  InstantCoreDatabase,
  InstantSchemaDef,
  PresenceOpts,
  PresenceResponse,
  RoomSchemaShape,
} from '@instantdb/core'
import {
  getCurrentScope,
  onScopeDispose,
  reactive,
  watchEffect,
} from 'vue'

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

export type PresenceHandle<
  PresenceShape,
  Keys extends keyof PresenceShape,
> = PresenceResponse<PresenceShape, Keys> & {
  publishPresence: (data: Partial<PresenceShape>) => void
}

export interface TypingIndicatorOpts {
  timeout?: number | null
  stopOnEnter?: boolean
  writeOnly?: boolean
}

export interface TypingIndicatorHandle<PresenceShape> {
  active: PresenceShape[]
  setActive: (active: boolean) => void
  inputProps: {
    onKeyDown: (e: KeyboardEvent) => void
    onBlur: () => void
  }
}

export const defaultActivityStopTimeout = 1_000

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
    const unsub = room.core._reactor.subscribeTopic(
      room.type,
      room.id,
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
    return () => { }
  }

  const stop = watchEffect((onCleanup) => {
    const unsub = room.core._reactor.joinRoom(room.type as string, room.id)
    onCleanup(unsub)
  })

  attachScopeCleanup(stop)

  return (data: RoomSchema[RoomType]['topics'][TopicType]) => {
    room.core._reactor.publishTopic({
      roomType: room.type,
      roomId: room.id,
      topic,
      data,
    })
  }
}

export function usePresence<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
  Keys extends keyof RoomSchema[RoomType]['presence'],
>(
  room: InstantVuxRoom<any, RoomSchema, RoomType>,
  opts: PresenceOpts<RoomSchema[RoomType]['presence'], Keys> = {},
): PresenceHandle<RoomSchema[RoomType]['presence'], Keys> {
  const fallback = {
    peers: {},
    isLoading: true,
  } as PresenceResponse<RoomSchema[RoomType]['presence'], Keys>

  const initial = hasRoomReactor(room)
    ? ((room.core._reactor.getPresence(room.type, room.id, opts)
      ?? fallback) as PresenceResponse<RoomSchema[RoomType]['presence'], Keys>)
    : fallback

  const state = reactive({
    ...initial,
    publishPresence: (data: Partial<RoomSchema[RoomType]['presence']>) => {
      if (!hasRoomReactor(room) || isServerRuntime()) {
        return
      }

      room.core._reactor.publishPresence(room.type, room.id, data)
    },
  }) as PresenceHandle<RoomSchema[RoomType]['presence'], Keys>

  if (isServerRuntime() || !hasRoomReactor(room)) {
    return state
  }

  const stop = watchEffect((onCleanup) => {
    void opts.user
    void opts.peers?.join('|')
    void opts.keys?.join('|')
    void JSON.stringify(opts.initialPresence ?? null)

    const unsub = room.core._reactor.subscribePresence(
      room.type,
      room.id,
      opts,
      (data: any) => {
        state.peers = data.peers
        state.isLoading = data.isLoading

        if ('user' in data) {
          const mutableState = state as any
          mutableState.user = data.user
        }
      },
    )

    onCleanup(unsub)
  })

  attachScopeCleanup(stop)

  return state
}

export function useSyncPresence<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
>(
  room: InstantVuxRoom<any, RoomSchema, RoomType>,
  data: Partial<RoomSchema[RoomType]['presence']>,
  deps?: any[],
): void {
  if (isServerRuntime() || !hasRoomReactor(room)) {
    return
  }

  const joinStop = watchEffect((onCleanup) => {
    const unsub = room.core._reactor.joinRoom(
      room.type as string,
      room.id,
      data,
    )

    onCleanup(unsub)
  })

  attachScopeCleanup(joinStop)

  const syncStop = watchEffect(() => {
    if (deps) {
      deps.forEach((dep) => {
        if (typeof dep === 'function') {
          dep()
        }
      })
    }
    else {
      JSON.stringify(data)
    }

    room.core._reactor.publishPresence(room.type, room.id, data)
  })

  attachScopeCleanup(syncStop)
}

export function useTypingIndicator<
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
>(
  room: InstantVuxRoom<any, RoomSchema, RoomType>,
  inputName: string,
  opts: TypingIndicatorOpts = {},
): TypingIndicatorHandle<RoomSchema[RoomType]['presence']> {
  if (isServerRuntime() || !hasRoomReactor(room)) {
    return {
      active: [],
      setActive() { },
      inputProps: {
        onKeyDown() { },
        onBlur() { },
      },
    }
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const presence = usePresence(room, {
    keys: [inputName] as (keyof RoomSchema[RoomType]['presence'])[],
  })

  const state = reactive({
    active: [] as RoomSchema[RoomType]['presence'][],
  })

  const activeStop = watchEffect(() => {
    if (opts.writeOnly) {
      state.active = []
      return
    }

    void presence.peers

    const presenceSnapshot = room.core._reactor.getPresence(room.type, room.id)
    state.active = Object.values(presenceSnapshot?.peers ?? {}).filter(
      (peer: any) => peer[inputName] === true,
    ) as typeof state.active
  })

  attachScopeCleanup(activeStop)

  const setActive = (isActive: boolean) => {
    room.core._reactor.publishPresence(room.type, room.id, {
      [inputName]: isActive ? true : null,
    } as Partial<RoomSchema[RoomType]['presence']>)

    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    if (!isActive) {
      return
    }

    if (opts.timeout === null || opts.timeout === 0) {
      return
    }

    timeoutId = setTimeout(() => {
      room.core._reactor.publishPresence(room.type, room.id, {
        [inputName]: null,
      } as Partial<RoomSchema[RoomType]['presence']>)
    }, opts.timeout ?? defaultActivityStopTimeout)
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      setActive(false)
    })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const shouldStop = opts.stopOnEnter && event.key === 'Enter'
    setActive(!shouldStop)
  }

  const onBlur = () => {
    setActive(false)
  }

  return {
    get active() {
      return state.active
    },
    setActive,
    inputProps: { onKeyDown, onBlur },
  }
}

export const rooms = {
  useTopicEffect,
  usePublishTopic,
  usePresence,
  useSyncPresence,
  useTypingIndicator,
}

export class InstantVuxRoom<
  Schema extends InstantSchemaDef<any, any, any>,
  RoomSchema extends RoomSchemaShape,
  RoomType extends keyof RoomSchema,
> {
  core: InstantCoreDatabase<Schema, boolean>
  type: RoomType
  id: string

  constructor(
    core: InstantCoreDatabase<Schema, boolean>,
    type: RoomType,
    id: string,
  ) {
    this.core = core
    this.type = type
    this.id = id
  }
}
