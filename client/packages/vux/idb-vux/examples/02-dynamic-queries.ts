import { $skip, computed, db } from './00-micro-setup'

/**
 * Dynamic queries using our Vue SDK
 *
 * 1) Use `() => {}` syntax in `useQueryX` or `useQuery` for queries with reactive dependencies
 * 2) Returning `null` to skip the entire query is supported
 * 3) Using `undefined` to skip a filter also works (here we use an idiomatic $skip alias)
 */

/* ────────────────────────────────────────── */
// A. USING VUE-EXCLUSIVE DX-FIRST APIs
/* ────────────────────────────────────────── */

export function useFilteredTodosX(userId: string | null, isDone?: boolean) {
  const query = db.useQueryX(() => {
    if (!userId)
      return null

    return {
      todos: {
        $: { where: { isDone: isDone ?? $skip } },
      },
    }
  })

  return { ...query.refs }
}

const { todos: todosX } = useFilteredTodosX(null)
console.warn(Array.isArray(todosX.value)) // true

/* ────────────────────────────────────────── */
// B. USING REGULAR APIs
/* ────────────────────────────────────────── */

export function useFilteredTodos(userId: string | null, isDone?: boolean) {
  const { isLoading, error, data } = db.useQuery(() => {
    if (!userId)
      return null

    return {
      todos: {
        $: { where: { isDone: isDone ?? $skip } },
      },
    }
  })

  const todos = computed(() => data.value?.todos ?? [])

  return { data, isLoading, error, todos }
}

const { todos: todosRegular } = useFilteredTodos(null)
console.warn(Array.isArray(todosRegular.value)) // true
