import type { InstantSchemaDef, RoomSchemaShape } from '@instantdb/core'
import type { PropType, ShallowRef, StyleValue, VNodeChild } from 'vue'
import type { InstantVuxRoom } from './InstantVuxRoom.js'
import {
  defineComponent,
  h,
  toValue,
} from 'vue'
import { usePresence } from './InstantVuxRoom.js'

type GenericRoom = InstantVuxRoom<
  InstantSchemaDef<any, any, any>,
  RoomSchemaShape,
  string
>

function hasRoomPresenceReactor(room: GenericRoom) {
  const reactor = (room as any)?.core?._reactor

  return Boolean(
    reactor
    && reactor.querySubs
    && typeof reactor.querySubs.updateInPlace === 'function'
    && reactor.kv
    && typeof reactor.kv.updateInPlace === 'function'
    && typeof reactor.getPresence === 'function'
    && typeof reactor.publishPresence === 'function',
  )
}

const DefaultCursor = defineComponent({
  name: 'InstantDefaultCursor',
  props: {
    color: {
      type: String,
      required: false,
      default: 'black',
    },
  },
  setup(props) {
    return () => {
      const fill = props.color || 'black'

      return h(
        'svg',
        {
          style: { height: '35px', width: '35px' },
          viewBox: '0 0 35 35',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
        },
        [
          h(
            'g',
            {
              fill: 'rgba(0,0,0,.2)',
              transform:
                'matrix(1, 0, 0, 1, -11.999999046325684, -8.406899452209473)',
            },
            [
              h('path', {
                d: 'm12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z',
              }),
              h('path', {
                d: 'm21.0845 25.0962-3.605 1.535-4.682-11.089 3.686-1.553z',
              }),
            ],
          ),
          h(
            'g',
            {
              fill: 'white',
              transform:
                'matrix(1, 0, 0, 1, -11.999999046325684, -8.406899452209473)',
            },
            [
              h('path', {
                d: 'm12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z',
              }),
              h('path', {
                d: 'm21.0845 25.0962-3.605 1.535-4.682-11.089 3.686-1.553z',
              }),
            ],
          ),
          h(
            'g',
            {
              fill,
              transform:
                'matrix(1, 0, 0, 1, -11.999999046325684, -8.406899452209473)',
            },
            [
              h('path', {
                d: 'm19.751 24.4155-1.844.774-3.1-7.374 1.841-.775z',
              }),
              h('path', {
                d: 'm13 10.814v11.188l2.969-2.866.428-.139h4.768z',
              }),
            ],
          ),
        ],
      )
    }
  },
})

const absStyles = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
}

const inertStyles = {
  overflow: 'hidden' as const,
  pointerEvents: 'none' as const,
  userSelect: 'none' as const,
}

const defaultZ = 99999

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  if (value < 0) {
    return 0
  }

  if (value > 100) {
    return 100
  }

  return value
}

export default defineComponent({
  name: 'InstantCursors',
  props: {
    room: {
      type: Object as PropType<GenericRoom>,
      required: true,
    },
    spaceId: {
      type: String,
      required: false,
    },
    as: {
      type: [String, Object] as PropType<any>,
      required: false,
      default: 'div',
    },
    className: {
      type: [String, Object, Array] as PropType<any>,
      required: false,
    },
    style: {
      type: [String, Object, Array] as PropType<StyleValue>,
      required: false,
    },
    userCursorColor: {
      type: String,
      required: false,
    },
    renderCursor: {
      type: Function as PropType<
        (props: { color: string, presence: unknown }) => VNodeChild
      >,
      required: false,
    },
    propagate: {
      type: Boolean,
      required: false,
    },
    zIndex: {
      type: Number,
      required: false,
    },
  },
  setup(props, { slots }) {
    const isServerRuntime = typeof window === 'undefined'
    const canPublish = !isServerRuntime && hasRoomPresenceReactor(props.room)

    const spaceId = props.spaceId
      || `cursors-space-default--${String(toValue(props.room.type))}-${toValue(props.room.id)}`

    const cursorsPresence = usePresence(props.room as any, {
      keys: [spaceId] as any,
    }) as unknown as {
      peers: ShallowRef<Record<string, any>>
      publishPresence: (data: Record<string, any>) => void
    }

    function publishCursor(
      target: Element,
      touch: { clientX: number, clientY: number },
    ) {
      if (!canPublish) {
        return
      }

      const rect = target.getBoundingClientRect()
      const htmlTarget = target as HTMLElement
      const supportsClientBox
        = typeof htmlTarget.clientWidth === 'number'
          && typeof htmlTarget.clientHeight === 'number'
          && typeof htmlTarget.clientLeft === 'number'
          && typeof htmlTarget.clientTop === 'number'

      const left = rect.left + (supportsClientBox ? htmlTarget.clientLeft : 0)
      const top = rect.top + (supportsClientBox ? htmlTarget.clientTop : 0)
      const width = supportsClientBox && htmlTarget.clientWidth > 0
        ? htmlTarget.clientWidth
        : rect.width
      const height = supportsClientBox && htmlTarget.clientHeight > 0
        ? htmlTarget.clientHeight
        : rect.height

      if (width <= 0 || height <= 0) {
        return
      }

      const x = touch.clientX
      const y = touch.clientY
      const xPercent = clampPercent(((x - left) / width) * 100)
      const yPercent = clampPercent(((y - top) / height) * 100)

      cursorsPresence.publishPresence({
        [spaceId]: { x, y, xPercent, yPercent, color: props.userCursorColor },
      })
    }

    function onMouseMove(event: MouseEvent) {
      if (!canPublish) {
        return
      }

      if (!props.propagate) {
        event.stopPropagation()
      }

      const target = event.currentTarget as Element | null
      if (!target) {
        return
      }

      publishCursor(target, event)
    }

    function clearCursor() {
      if (!canPublish) {
        return
      }

      cursorsPresence.publishPresence({
        [spaceId]: undefined,
      })
    }

    function onTouchMove(event: TouchEvent) {
      if (!canPublish || event.touches.length !== 1) {
        return
      }

      const touch = event.touches.item(0)
      const target = event.currentTarget as Element | null
      if (!touch || !target) {
        return
      }

      if (!props.propagate) {
        event.stopPropagation()
      }

      publishCursor(target, touch)
    }

    return () => {
      const as = props.as
      const reactor = hasRoomPresenceReactor(props.room)
        ? props.room.core._reactor
        : null

      const fullPresence = reactor?.getPresence?.(
        toValue(props.room.type),
        toValue(props.room.id),
      )
      const peers = cursorsPresence?.peers.value ?? {}

      const overlayChildren = Object.entries(peers).map(([peerId, presence]) => {
        const cursor = (presence as any)?.[spaceId]
        if (!cursor) {
          return null
        }

        const cursorPresence = fullPresence?.peers?.[peerId]

        let cursorNode: VNodeChild
        if (slots.cursor) {
          cursorNode = slots.cursor({
            color: cursor.color,
            presence: cursorPresence,
          })
        }
        else if (props.renderCursor) {
          cursorNode = props.renderCursor({
            color: cursor.color,
            presence: cursorPresence,
          })
        }
        else {
          cursorNode = h(DefaultCursor, { color: cursor.color })
        }

        return h(
          'div',
          {
            key: peerId,
            style: {
              ...absStyles,
              transform: `translate(${cursor.xPercent}%, ${cursor.yPercent}%)`,
              transformOrigin: '0 0',
              transition: 'transform 100ms',
            },
          },
          cursorNode ?? undefined,
        )
      })

      return h(
        as as any,
        {
          class: props.className,
          style: [{ position: 'relative' }, props.style],
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
              key: spaceId,
              style: {
                ...absStyles,
                ...inertStyles,
                zIndex: props.zIndex ?? defaultZ,
              },
            },
            overlayChildren,
          ),
        ],
      )
    }
  },
})
