import { db } from './00-micro-setup'

/**
 * One-off reads using queryOnceX and queryOnce
 *
 * 1) `queryOnceX` keeps typed query authoring + namespace array defaults.
 * 2) `queryOnce` keeps the parity response shape and can be used directly too.
 */

/* ────────────────────────────────────────── */
// A. USING VUE-EXCLUSIVE DX-FIRST APIs
/* ────────────────────────────────────────── */

export async function fetchTodosOnceX() {
  const result = await db.queryOnceX({
    todos: {
      $: {
        limit: 10,
      },
    },
  })

  return result.todos
}

void fetchTodosOnceX().then((todosX) => {
  console.warn(Array.isArray(todosX)) // true
})

/* ────────────────────────────────────────── */
// B. USING REGULAR APIs
/* ────────────────────────────────────────── */

export async function fetchTodosOnce() {
  const result = await db.queryOnce({
    todos: {
      $: {
        limit: 10,
      },
    },
  })

  return result.data.todos ?? []
}

void fetchTodosOnce().then((todosRegular) => {
  console.warn(Array.isArray(todosRegular)) // true
})
