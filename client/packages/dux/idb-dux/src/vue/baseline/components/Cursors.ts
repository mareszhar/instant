import type { ComputedRef, PropType } from 'vue'
// Vendored from @instantdb/vue/src/components/Cursors.vue — see UPSTREAM.md.
// DUX-DELTA(components): shipped as a `.ts` render function rather than a
// `.vue` SFC. Behavior matches the SFC: publish the local cursor on
// pointer/touch move, render peer cursors from presence.
import { computed, defineComponent, h, toValue } from 'vue'
import { usePresence } from '../IdbDuxRoom.js'
import Cursor from './Cursor.js'

interface CursorPresence {
  x: number
  y: number
  xPercent: number
  yPercent: number
  color?: string
}

// DUX-DELTA(types): the runtime `room` prop is the loose room handle, not a
// concrete `IdbDuxRoom`. The official SFC infers `RoomSchema`/`RoomType`
// per use; a `.ts` render fn can't express inferring generic props, and a
// concrete room would reject one read back through Vue/Pinia reactivity (which
// unwraps its deep `core`/reactor types). `core` is left loose so the handle
// assigns however it's stored — no `markRaw` ceremony at the call site. It
// stays assignable *to* `IdbDuxRoom<any, any, any>` for the internal
// `usePresence` call.
interface GenericRoom {
  type: ComputedRef<string> | string
  id: ComputedRef<string> | string
  core: any
}

export const Cursors = defineComponent({
  name: 'Cursors',
  props: {
    room: { type: Object as PropType<GenericRoom>, required: true },
    spaceId: { type: String, required: false },
    as: { type: String, default: 'div' },
    userCursorColor: { type: String, required: false },
    propagate: { type: Boolean, default: false },
    zIndex: { type: Number, default: 99999 },
  },
  setup(props, { slots }) {
    const spaceId = computed(
      () =>
        props.spaceId
        || `cursors-space-default--${String(toValue(props.room.type))}-${toValue(props.room.id)}`,
    )

    const { peers, publishPresence } = usePresence(props.room, {
      keys: [spaceId.value] as any,
    })

    const fullPresence = computed(() => {
      void peers.value
      return props.room.core._reactor.getPresence(
        toValue(props.room.type),
        toValue(props.room.id),
      )
    })

    const cursorPeers = computed(() => {
      const sid = spaceId.value
      return Object.entries(peers.value || {}).flatMap(([peerId, p]) => {
        const cursor = (p as any)?.[sid] as CursorPresence | undefined
        return cursor ? [{ peerId, cursor }] : []
      })
    })

    function publishCursor(
      rect: DOMRect,
      touch: { clientX: number, clientY: number },
    ) {
      const x = touch.clientX
      const y = touch.clientY
      const xPercent = ((x - rect.left) / rect.width) * 100
      const yPercent = ((y - rect.top) / rect.height) * 100
      publishPresence({
        [spaceId.value]: { x, y, xPercent, yPercent, color: props.userCursorColor },
      } as any)
    }

    function onMouseMove(e: MouseEvent) {
      if (!props.propagate)
        e.stopPropagation()
      const rect = (e.currentTarget as Element).getBoundingClientRect()
      publishCursor(rect, e)
    }

    function clearCursor() {
      publishPresence({ [spaceId.value]: undefined } as any)
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length !== 1)
        return
      const touch = e.touches[0]
      if (!touch || !(touch.target instanceof Element))
        return
      if (!props.propagate)
        e.stopPropagation()
      const rect = touch.target.getBoundingClientRect()
      publishCursor(rect, touch)
    }

    return () =>
      h(
        props.as,
        {
          style: { position: 'relative' },
          onMousemove: onMouseMove,
          onMouseout: clearCursor,
          onBlur: clearCursor,
          onTouchmove: onTouchMove,
          onTouchend: clearCursor,
        },
        [
          slots.default?.(),
          h(
            'div',
            {
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: props.zIndex,
              },
            },
            cursorPeers.value.map(({ peerId, cursor }) =>
              h(
                'div',
                {
                  key: peerId,
                  style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    transform: `translate(${cursor.xPercent}%, ${cursor.yPercent}%)`,
                    transformOrigin: '0 0',
                    transition: 'transform 100ms',
                  },
                },
                slots.cursor
                  ? slots.cursor({
                      color: cursor.color,
                      presence: fullPresence.value?.peers[peerId],
                    })
                  : h(Cursor, { color: cursor.color ?? '' }),
              ),
            ),
          ),
        ],
      )
  },
})

export default Cursors
