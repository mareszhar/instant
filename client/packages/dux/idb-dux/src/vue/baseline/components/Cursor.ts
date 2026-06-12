// Vendored from @instantdb/vue/src/components/Cursor.vue — see UPSTREAM.md.
// DUX-DELTA(components): shipped as a `.ts` render function rather than a
// `.vue` SFC, so the library needs no SFC compile step and the boundary lint
// can see the source. Behavior matches the SFC.
import { defineComponent, h } from 'vue'

const paths = [
  { fill: 'rgba(0,0,0,.2)', useColor: false },
  { fill: 'white', useColor: false },
  { fill: null, useColor: true },
] as const

export const Cursor = defineComponent({
  name: 'Cursor',
  props: { color: { type: String, required: true } },
  setup(props) {
    return () =>
      h(
        'svg',
        {
          style: { height: '35px', width: '35px' },
          viewBox: '0 0 35 35',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
        },
        paths.map((layer, index) =>
          h(
            'g',
            {
              key: index,
              fill: layer.useColor ? props.color || 'black' : layer.fill,
              transform:
                'matrix(1, 0, 0, 1, -11.999999046325684, -8.406899452209473)',
            },
            index === 2
              ? [
                  h('path', { d: 'm19.751 24.4155-1.844.774-3.1-7.374 1.841-.775z' }),
                  h('path', { d: 'm13 10.814v11.188l2.969-2.866.428-.139h4.768z' }),
                ]
              : [
                  h('path', { d: 'm12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z' }),
                  h('path', { d: 'm21.0845 25.0962-3.605 1.535-4.682-11.089 3.686-1.553z' }),
                ],
          ),
        ),
      )
  },
})

export default Cursor
