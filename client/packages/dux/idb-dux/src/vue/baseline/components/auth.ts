import type { PropType } from 'vue'
import type { InstantDuxDatabase } from '../InstantDuxDatabase.js'
// Vendored from @instantdb/vue/src/components/SignedIn.vue + SignedOut.vue —
// see UPSTREAM.md.
// DUX-DELTA(components): shipped as `.ts` render functions rather than `.vue`
// SFCs. Behavior matches the SFCs: render the default slot only when the auth
// gate is satisfied and not loading/errored.
import { defineComponent } from 'vue'

type AnyDb = InstantDuxDatabase<any, any>

export const SignedIn = defineComponent({
  name: 'SignedIn',
  props: { db: { type: Object as PropType<AnyDb>, required: true } },
  setup(props, { slots }) {
    const { isLoading, error, user } = props.db.useAuth()
    return () =>
      !isLoading.value && !error.value && user.value ? slots.default?.() : null
  },
})

export const SignedOut = defineComponent({
  name: 'SignedOut',
  props: { db: { type: Object as PropType<AnyDb>, required: true } },
  setup(props, { slots }) {
    const { isLoading, error, user } = props.db.useAuth()
    return () =>
      !isLoading.value && !error.value && !user.value ? slots.default?.() : null
  },
})
