import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { InstantVuxRoom, rooms } from '../InstantVuxRoom.js'

function createMockCore() {
  const getPresence = vi.fn<(roomType?: any, roomId?: any, opts?: any) => any>(
    () => null,
  )

  const subscribeTopic = vi.fn<
    (
      roomType: any,
      roomId: any,
      topic: any,
      cb: (event: any, peer: any) => void,
    ) => () => void
  >(() => vi.fn())

  const subscribePresence = vi.fn<
    (
      roomType: any,
      roomId: any,
      opts: any,
      cb: (data: any) => void,
    ) => () => void
  >(() => vi.fn())

  const joinRoom = vi.fn<(roomType: any, roomId: any, data?: any) => () => void>(
    () => vi.fn(),
  )

  return {
    _reactor: {
      querySubs: {
        updateInPlace: vi.fn(),
      },
      kv: {
        updateInPlace: vi.fn(),
      },
      getPresence,
      subscribeTopic,
      subscribePresence,
      joinRoom,
      publishPresence: vi.fn(),
      publishTopic: vi.fn(),
    },
  }
}

describe('instantVuxRoom hooks', () => {
  let mockCore: ReturnType<typeof createMockCore>
  let room: InstantVuxRoom<any, any, any>
  let originalWindow: any

  function withServerRuntime<T>(run: () => T): T {
    const currentWindow = (globalThis as any).window
    vi.stubGlobal('window', undefined)

    try {
      return run()
    }
    finally {
      vi.stubGlobal('window', currentWindow)
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCore = createMockCore()
    room = new InstantVuxRoom(mockCore as any, 'chat', 'room-1')
    originalWindow = (globalThis as any).window
  })

  afterEach(() => {
    vi.stubGlobal('window', originalWindow)
  })

  it('useTopicEffect subscribes and unsubscribes', async () => {
    const unsub = vi.fn()
    let topicCb: ((event: any, peer: any) => void) | undefined

    mockCore._reactor.subscribeTopic.mockImplementation(
      (_roomType: any, _roomId: any, _topic: any, cb: any) => {
        topicCb = cb
        return unsub
      },
    )

    const handler = vi.fn()
    const scope = effectScope()

    scope.run(() => {
      const useTopicEffect = rooms.useTopicEffect as any
      useTopicEffect(room, 'emoji', handler)
    })

    await nextTick()

    expect(mockCore._reactor.subscribeTopic).toHaveBeenCalledWith(
      'chat',
      'room-1',
      'emoji',
      expect.any(Function),
    )

    topicCb?.({ emoji: '🔥' }, { name: 'Alice' })
    expect(handler).toHaveBeenCalledWith({ emoji: '🔥' }, { name: 'Alice' })

    scope.stop()
    expect(unsub).toHaveBeenCalled()
  })

  it('usePublishTopic joins room and publishes topic', async () => {
    const scope = effectScope()
    let publish: ((data: any) => void) | undefined

    scope.run(() => {
      publish = (rooms.usePublishTopic as any)(room, 'emoji')
    })

    await nextTick()

    expect(mockCore._reactor.joinRoom).toHaveBeenCalledWith('chat', 'room-1')

    publish?.({ emoji: '🔥' })
    expect(mockCore._reactor.publishTopic).toHaveBeenCalledWith({
      roomType: 'chat',
      roomId: 'room-1',
      topic: 'emoji',
      data: { emoji: '🔥' },
    })

    scope.stop()
  })

  it('usePresence returns refs and updates from subscription', async () => {
    mockCore._reactor.getPresence.mockReturnValue({
      peers: { p1: { name: 'Alice' } },
      isLoading: false,
      user: { name: 'Me' },
    })

    let presenceCb: ((data: any) => void) | undefined
    const unsub = vi.fn()

    mockCore._reactor.subscribePresence.mockImplementation(
      (_roomType: any, _roomId: any, _opts: any, cb: any) => {
        presenceCb = cb
        return unsub
      },
    )

    const scope = effectScope()
    let presence: any

    scope.run(() => {
      presence = (rooms.usePresence as any)(room, { keys: ['name'] })
    })

    await nextTick()

    expect(presence.isLoading.value).toBe(false)
    expect(presence.peers.value).toEqual({ p1: { name: 'Alice' } })
    expect(presence.user.value).toEqual({ name: 'Me' })

    presence.publishPresence({ status: 'online' })
    expect(mockCore._reactor.publishPresence).toHaveBeenCalledWith(
      'chat',
      'room-1',
      { status: 'online' },
    )

    presenceCb?.({
      peers: { p2: { name: 'Bob' } },
      isLoading: false,
      error: { message: 'Presence failed' },
    })
    await nextTick()

    expect(presence.peers.value).toEqual({ p2: { name: 'Bob' } })
    expect(presence.isLoading.value).toBe(false)
    expect((presence as any).error.value).toEqual({ message: 'Presence failed' })

    scope.stop()
    expect(unsub).toHaveBeenCalled()
  })

  it('usePresence does not re-subscribe when presence callbacks update refs', async () => {
    let presenceCb: ((data: any) => void) | undefined

    mockCore._reactor.subscribePresence.mockImplementation(
      (_roomType: any, _roomId: any, _opts: any, cb: any) => {
        presenceCb = cb
        return () => {}
      },
    )

    const scope = effectScope()
    scope.run(() => {
      (rooms.usePresence as any)(room, { keys: ['name'] })
    })
    await nextTick()

    expect(mockCore._reactor.subscribePresence).toHaveBeenCalledTimes(1)

    presenceCb?.({
      peers: { p2: { name: 'Bob' } },
      isLoading: false,
      user: { name: 'Me' },
      error: undefined,
    })
    await nextTick()

    expect(mockCore._reactor.subscribePresence).toHaveBeenCalledTimes(1)

    scope.stop()
  })

  it('usePresenceX exposes refs plus state alias from one source', async () => {
    const scope = effectScope()
    let presenceX: any

    scope.run(() => {
      presenceX = (rooms.usePresenceX as any)(room, { keys: ['name'] })
    })

    await nextTick()

    expect(presenceX.refs).toBe(presenceX)
    expect(presenceX.peers.value).toEqual({})
    expect(presenceX.state.peers).toEqual({})
    expect(typeof presenceX.state.publishPresence).toBe('function')

    scope.stop()
  })

  it('useSyncPresence joins room and publishes on data changes', async () => {
    const data = reactive({ nickname: 'alice' })

    const scope = effectScope()
    scope.run(() => {
      const useSyncPresence = rooms.useSyncPresence as any
      useSyncPresence(room, data)
    })

    await nextTick()

    expect(mockCore._reactor.joinRoom).toHaveBeenCalledWith(
      'chat',
      'room-1',
      data,
    )

    expect(mockCore._reactor.publishPresence).toHaveBeenCalledWith(
      'chat',
      'room-1',
      data,
    )

    data.nickname = 'bob'
    await nextTick()

    expect(mockCore._reactor.publishPresence).toHaveBeenCalledTimes(1)

    scope.stop()
  })

  it('useSyncPresence accepts reactive getter inputs', async () => {
    const nickname = ref('alice')

    const scope = effectScope()
    scope.run(() => {
      const useSyncPresence = rooms.useSyncPresence as any
      useSyncPresence(room, () => ({ nickname: nickname.value }))
    })

    await nextTick()

    expect(mockCore._reactor.joinRoom).toHaveBeenCalledWith(
      'chat',
      'room-1',
      { nickname: 'alice' },
    )
    expect(mockCore._reactor.publishPresence).toHaveBeenCalledWith(
      'chat',
      'room-1',
      { nickname: 'alice' },
    )

    nickname.value = 'bob'
    await nextTick()

    expect(mockCore._reactor.publishPresence).toHaveBeenLastCalledWith(
      'chat',
      'room-1',
      { nickname: 'bob' },
    )

    scope.stop()
  })

  it('useTypingIndicator exposes lowercase listener keys for Vue v-bind compatibility', async () => {
    const scope = effectScope()
    let typing: any

    scope.run(() => {
      typing = (rooms.useTypingIndicator as any)(room, 'chat')
    })

    await nextTick()

    expect(typeof typing.inputProps.onKeydown).toBe('function')
    expect(typeof typing.inputProps.onBlur).toBe('function')
    expect((typing.inputProps as any).onKeyDown).toBeUndefined()

    scope.stop()
  })

  it('useTypingIndicator tracks active peers and publishes timeout cleanup', async () => {
    vi.useFakeTimers()

    const presenceSnapshot = {
      peers: {
        p1: { chat: true, name: 'Alice' },
      },
      isLoading: false,
    }

    mockCore._reactor.getPresence.mockImplementation(() => presenceSnapshot)

    let presenceCb: ((data: any) => void) | undefined
    mockCore._reactor.subscribePresence.mockImplementation(
      (_roomType: any, _roomId: any, _opts: any, cb: any) => {
        presenceCb = cb
        return () => {}
      },
    )

    const scope = effectScope()
    let typing: any

    scope.run(() => {
      typing = (rooms.useTypingIndicator as any)(room, 'chat')
    })

    await nextTick()
    presenceCb?.(presenceSnapshot)
    await nextTick()

    expect(typing.active.value).toEqual([{ chat: true, name: 'Alice' }])

    typing.setActive(true)
    expect(mockCore._reactor.publishPresence).toHaveBeenCalledWith(
      'chat',
      'room-1',
      { chat: true },
    )

    vi.advanceTimersByTime(1_000)

    expect(mockCore._reactor.publishPresence).toHaveBeenLastCalledWith(
      'chat',
      'room-1',
      { chat: null },
    )

    scope.stop()
    vi.useRealTimers()
  })

  it('useTypingIndicator does not re-subscribe to presence after callback updates', async () => {
    const presenceSnapshot = {
      peers: {
        p1: { chat: true, name: 'Alice' },
      },
      isLoading: false,
    }

    let presenceCb: ((data: any) => void) | undefined
    mockCore._reactor.getPresence.mockImplementation(() => presenceSnapshot)
    mockCore._reactor.subscribePresence.mockImplementation(
      (_roomType: any, _roomId: any, _opts: any, cb: any) => {
        presenceCb = cb
        return () => {}
      },
    )

    const scope = effectScope()
    let typing: any

    scope.run(() => {
      typing = (rooms.useTypingIndicator as any)(room, 'chat')
    })
    await nextTick()

    expect(mockCore._reactor.subscribePresence).toHaveBeenCalledTimes(1)

    presenceCb?.(presenceSnapshot)
    await nextTick()

    expect(typing.active.value).toEqual([{ chat: true, name: 'Alice' }])
    expect(mockCore._reactor.subscribePresence).toHaveBeenCalledTimes(1)

    scope.stop()
  })

  it('useTypingIndicatorX exposes refs plus state alias from one source', async () => {
    const scope = effectScope()
    let typingX: any

    scope.run(() => {
      typingX = (rooms.useTypingIndicatorX as any)(room, 'chat')
    })

    await nextTick()

    expect(typingX.refs).toBe(typingX)
    expect(Array.isArray(typingX.active.value)).toBe(true)
    expect(Array.isArray(typingX.state.active)).toBe(true)
    expect(typingX.state.active).toEqual(typingX.active.value)
    expect(typeof typingX.state.setActive).toBe('function')

    scope.stop()
  })

  it('useTypingIndicator supports writeOnly mode', async () => {
    const presenceSnapshot = {
      peers: {
        p1: { chat: true, name: 'Alice' },
      },
      isLoading: false,
    }

    mockCore._reactor.getPresence.mockImplementation(() => presenceSnapshot)
    mockCore._reactor.subscribePresence.mockImplementation(
      (_roomType: any, _roomId: any, _opts: any, cb: any) => {
        cb(presenceSnapshot)
        return () => {}
      },
    )

    const scope = effectScope()
    let typing: any

    scope.run(() => {
      typing = (rooms.useTypingIndicator as any)(room, 'chat', {
        writeOnly: true,
      })
    })

    await nextTick()
    expect(typing.active.value).toEqual([])

    scope.stop()
  })

  it('useTypingIndicator does not auto-clear when timeout is 0', async () => {
    vi.useFakeTimers()

    const scope = effectScope()
    let typing: any

    scope.run(() => {
      typing = (rooms.useTypingIndicator as any)(room, 'chat', { timeout: 0 })
    })

    await nextTick()
    typing.setActive(true)

    expect(mockCore._reactor.publishPresence).toHaveBeenNthCalledWith(
      1,
      'chat',
      'room-1',
      { chat: true },
    )

    vi.advanceTimersByTime(2_000)
    expect(mockCore._reactor.publishPresence).toHaveBeenCalledTimes(1)

    scope.stop()
    vi.useRealTimers()
  })

  it('useTypingIndicator clears activity on blur and Enter when stopOnEnter is enabled', async () => {
    const scope = effectScope()
    let typing: any

    scope.run(() => {
      typing = (rooms.useTypingIndicator as any)(room, 'chat', {
        stopOnEnter: true,
        timeout: null,
      })
    })

    await nextTick()

    typing.inputProps.onKeydown(new KeyboardEvent('keydown', { key: 'a' }))
    typing.inputProps.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))
    typing.inputProps.onBlur()

    expect(mockCore._reactor.publishPresence).toHaveBeenNthCalledWith(
      1,
      'chat',
      'room-1',
      { chat: true },
    )

    expect(mockCore._reactor.publishPresence).toHaveBeenNthCalledWith(
      2,
      'chat',
      'room-1',
      { chat: null },
    )

    expect(mockCore._reactor.publishPresence).toHaveBeenNthCalledWith(
      3,
      'chat',
      'room-1',
      { chat: null },
    )

    scope.stop()
  })

  it('returns inert no-op handles on server runtime', () => {
    withServerRuntime(() => {
      const scope = effectScope()

      scope.run(() => {
        const useTopicEffect = rooms.useTopicEffect as any
        useTopicEffect(room, 'emoji', vi.fn())
      })

      expect(mockCore._reactor.subscribeTopic).not.toHaveBeenCalled()

      const publish = (rooms.usePublishTopic as any)(room, 'emoji')
      publish({ emoji: '🔥' })
      expect(mockCore._reactor.joinRoom).not.toHaveBeenCalled()
      expect(mockCore._reactor.publishTopic).not.toHaveBeenCalled()

      const presence = (rooms.usePresence as any)(room, { keys: ['name'] })
      expect(presence.isLoading.value).toBe(true)
      expect(presence.peers.value).toEqual({})
      presence.publishPresence({ name: 'server' })
      expect(mockCore._reactor.publishPresence).not.toHaveBeenCalled()

      const useSyncPresence = rooms.useSyncPresence as any
      useSyncPresence(room, { name: 'server' })
      expect(mockCore._reactor.joinRoom).not.toHaveBeenCalled()

      const typing = (rooms.useTypingIndicator as any)(room, 'chat')
      expect(typing.active.value).toEqual([])
      typing.setActive(true)
      typing.inputProps.onKeydown(new KeyboardEvent('keydown', { key: 'a' }))
      typing.inputProps.onBlur()

      expect(mockCore._reactor.publishPresence).not.toHaveBeenCalled()

      scope.stop()
    })
  })

  it('returns inert no-op handles when reactor is uninitialized', () => {
    const brokenRoom = new InstantVuxRoom(
      {
        _reactor: {
          ...mockCore._reactor,
          querySubs: undefined,
        },
      } as any,
      'chat',
      'room-1',
    )

    const publish = (rooms.usePublishTopic as any)(brokenRoom, 'emoji')
    publish({ emoji: '🔥' })

    const presence = (rooms.usePresence as any)(brokenRoom, { keys: ['name'] })
    expect(presence.isLoading.value).toBe(true)
    expect(mockCore._reactor.joinRoom).not.toHaveBeenCalled()
    expect(mockCore._reactor.publishTopic).not.toHaveBeenCalled()
  })
})
