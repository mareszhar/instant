/**
 * `$only` is a `true` constant sharing its name with the `$:` key it enables,
 * so property shorthand reads as the declaration it is:
 * `$: { where: { id }, $only }` ≡ `$: { where: { id }, $only: true }`.
 */
export const $only = true as const

/**
 * `$skip` is an `undefined` constant: an `undefined` value in a `where`
 * clause drops that clause before the query goes on the wire, so
 * `where: { workspace: current?.id ?? $skip }` reads as intended.
 */
export const $skip = undefined
