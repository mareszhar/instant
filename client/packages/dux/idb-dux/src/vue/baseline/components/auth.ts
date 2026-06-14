import type { PropType, Ref } from 'vue'
// Vendored from @instantdb/vue/src/components/SignedIn.vue + SignedOut.vue —
// see UPSTREAM.md.
// DUX-DELTA(components): shipped as `.ts` render functions rather than `.vue`
// SFCs. Behavior matches the SFCs: render the default slot only when the auth
// gate is satisfied and not loading/errored.
import { defineComponent } from 'vue'

// DUX-DELTA(types): the `db` prop is the minimal auth-gate surface, not the
// full baseline db. The public surface is the overlay `IdbClient` (the only db
// users hold); both it and the baseline satisfy this, so `:db="db"` typechecks
// with the public db without the components reaching up into the overlay layer.
interface AuthGateDb {
  useAuth: () => {
    isLoading: Ref<boolean>
    error: Ref<unknown>
    user: Ref<unknown>
  }
}
type AnyDb = AuthGateDb
// END DUX-DELTA

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
