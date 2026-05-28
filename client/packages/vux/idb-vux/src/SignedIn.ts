import type { PropType } from 'vue'
import type { InstantVuxDatabase } from './InstantVuxDatabase.js'
import { defineComponent } from 'vue'

type AnyInstantVuxDatabase = InstantVuxDatabase<any, any, any, any>

export default defineComponent({
  name: 'InstantSignedIn',
  props: {
    db: {
      type: Object as PropType<AnyInstantVuxDatabase>,
      required: true,
    },
  },
  setup(props, { slots }) {
    const auth = props.db.useAuth()

    return () => {
      if (auth.isLoading.value || auth.error.value || !auth.user.value) {
        return null
      }

      return slots.default?.()
    }
  },
})
