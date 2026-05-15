import { computed, db, id } from './00-micro-setup'

/**
 * React README parity-style micro-demo using our Vue SDK
 *
 * 1) Read: useQueryX or useQuery
 * 2) Write: transact + tx
 * 3) Render: return reactive query payload for UI components
 */

/* ────────────────────────────────────────── */
// A. USING VUE-EXCLUSIVE DX-FIRST APIs
/* ────────────────────────────────────────── */

export function useTodosX() {
  const query = db.useQueryX({ todos: {} })

  const addTodo = async (title: string) => {
    await db.transact(db.tx.todos[id()].update({ title, isDone: false }))
  }

  return { ...query.refs, addTodo }
}

const { todos: todosX } = useTodosX()
console.warn(Array.isArray(todosX.value)) // true

/* ────────────────────────────────────────── */
// B. USING REGULAR APIs
/* ────────────────────────────────────────── */

export function useTodos() {
  const { isLoading, error, data } = db.useQuery({ todos: {} })

  const todos = computed(() => data.value?.todos ?? [])

  const addTodo = async (title: string) => {
    await db.transact(db.tx.todos[id()].update({ title, isDone: false }))
  }

  return { isLoading, error, data, todos, addTodo }
}

const { todos: todosRegular } = useTodos()
console.warn(Array.isArray(todosRegular.value)) // true
