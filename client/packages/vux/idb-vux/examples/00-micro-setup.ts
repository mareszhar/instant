import { i, init } from '@mszr/idb-vux'

export { id } from '@mszr/idb-vux'
export { computed } from 'vue'

/**
 * Placeholder value to indicate that a filter should be skipped.
 *
 * It is semantically equivalent to `undefined` but makes code more
 * self-documenting when used with dynamic query filters.
 */

export const $skip = undefined

export const schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique(),
      name: i.string().indexed(),
    }),
    todos: i.entity({
      title: i.string().indexed(),
      isDone: i.boolean().indexed(),
    }),
  },
  links: {
    userTodos: {
      forward: { on: '$users', has: 'many', label: 'ownedTodos' },
      reverse: { on: 'todos', has: 'one', label: 'ownerUser' },
    },
  },
})

export const db = init({ appId: 'YOUR_APP_ID', schema })
