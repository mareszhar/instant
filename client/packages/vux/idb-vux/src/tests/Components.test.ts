import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, h, nextTick, reactive } from 'vue'
import Cursors from '../Cursors.js'
import { InstantVuxRoom } from '../InstantVuxRoom.js'
import SignedIn from '../SignedIn.js'
import SignedOut from '../SignedOut.js'

function createAuthDb(initial: any) {
  const authState = reactive(initial)

  return {
    authState,
    db: {
      useAuth: () => ({
        isLoading: computed(() => authState.isLoading),
        user: computed(() => authState.user),
        error: computed(() => authState.error),
      }),
    },
  }
}

function createRoomWithReactor(reactorOverrides: Record<string, any> = {}) {
  const reactor = {
    querySubs: {
      updateInPlace: vi.fn(),
    },
    kv: {
      updateInPlace: vi.fn(),
    },
    getPresence: vi.fn(() => null),
    subscribeTopic: vi.fn(() => vi.fn()),
    subscribePresence: vi.fn(() => vi.fn()),
    publishPresence: vi.fn(),
    publishTopic: vi.fn(),
    joinRoom: vi.fn(() => vi.fn()),
    ...reactorOverrides,
  }

  const core = { _reactor: reactor } as any
  const room = new InstantVuxRoom(core, 'demo', 'main')

  return { room, reactor }
}

describe('signedIn / SignedOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signedIn only renders children for authenticated users', async () => {
    const { authState, db } = createAuthDb({
      isLoading: true,
      user: undefined,
      error: undefined,
    })

    const wrapper = mount(SignedIn, {
      props: { db: db as any },
      slots: {
        default: '<div class="private">Private content</div>',
      },
    })

    expect(wrapper.find('.private').exists()).toBe(false)

    authState.isLoading = false
    authState.user = { id: 'u1', email: 'ok@test.com' }
    await nextTick()

    expect(wrapper.find('.private').exists()).toBe(true)
  })

  it('signedOut only renders children for signed-out users', async () => {
    const { authState, db } = createAuthDb({
      isLoading: false,
      user: { id: 'u1' },
      error: undefined,
    })

    const wrapper = mount(SignedOut, {
      props: { db: db as any },
      slots: {
        default: '<div class="public">Public content</div>',
      },
    })

    expect(wrapper.find('.public').exists()).toBe(false)

    authState.user = undefined
    await nextTick()

    expect(wrapper.find('.public').exists()).toBe(true)
  })
})

describe('cursors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publishes cursor positions and clears on mouse out', async () => {
    const { room, reactor } = createRoomWithReactor()

    const wrapper = mount(Cursors as any, {
      props: {
        room,
      },
      slots: {
        default: '<div class="canvas">Canvas</div>',
      },
    })

    const root = wrapper.element as HTMLElement
    const rootElement = root as any
    rootElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      right: 100,
      bottom: 100,
      toJSON: () => ({}),
    })

    await wrapper.trigger('mousemove', { clientX: 25, clientY: 30 })

    expect(reactor.publishPresence).toHaveBeenCalledWith('demo', 'main', {
      'cursors-space-default--demo-main': {
        x: 25,
        y: 30,
        xPercent: 25,
        yPercent: 30,
        color: undefined,
      },
    })

    await wrapper.trigger('mouseout')

    expect(reactor.publishPresence).toHaveBeenLastCalledWith('demo', 'main', {
      'cursors-space-default--demo-main': undefined,
    })
  })

  it('prefers cursor slot over renderCursor prop', () => {
    const spaceId = 'cursors-space-default--demo-main'
    const initialPresence = {
      peers: {
        peerA: {
          [spaceId]: {
            x: 10,
            y: 20,
            xPercent: 10,
            yPercent: 20,
            color: 'tomato',
          },
          name: 'Alice',
        },
      },
      isLoading: false,
    }

    const { room, reactor } = createRoomWithReactor({
      getPresence: vi.fn(() => initialPresence),
      subscribePresence: vi.fn(() => vi.fn()),
    })

    const wrapper = mount(Cursors as any, {
      props: {
        room,
        renderCursor: () => h('div', { class: 'render-cursor' }, 'render'),
      },
      slots: {
        cursor: ({ color }: any) => h('div', { class: 'slot-cursor' }, `slot-${color}`),
      },
    })

    expect(reactor.getPresence).toHaveBeenCalled()
    expect(wrapper.find('.slot-cursor').exists()).toBe(true)
    expect(wrapper.find('.render-cursor').exists()).toBe(false)
  })

  it('uses renderCursor prop when cursor slot is not provided', () => {
    const spaceId = 'cursors-space-default--demo-main'
    const initialPresence = {
      peers: {
        peerA: {
          [spaceId]: {
            x: 10,
            y: 20,
            xPercent: 10,
            yPercent: 20,
            color: 'tomato',
          },
          name: 'Alice',
        },
      },
      isLoading: false,
    }

    const { room } = createRoomWithReactor({
      getPresence: vi.fn(() => initialPresence),
      subscribePresence: vi.fn(() => vi.fn()),
    })

    const wrapper = mount(Cursors as any, {
      props: {
        room,
        renderCursor: () => h('div', { class: 'render-cursor' }, 'render'),
      },
    })

    expect(wrapper.find('.render-cursor').exists()).toBe(true)
    expect(wrapper.find('.slot-cursor').exists()).toBe(false)
  })

  it('renders safely when room reactor is missing', () => {
    const room = new InstantVuxRoom({ _reactor: {} } as any, 'demo', 'main')

    const wrapper = mount(Cursors as any, {
      props: { room },
      slots: {
        default: '<div class="canvas">Canvas</div>',
      },
    })

    expect(wrapper.find('.canvas').exists()).toBe(true)
  })
})
