/**
 * Flatten a computed object type (mapped-type intersections, alias chains)
 * into a plain `{ key: value }` shape — both for exact type equality and for
 * readable editor hovers.
 */
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never

/** Collapse a union of object types into their intersection. */
export type UnionToIntersection<U> = (
  U extends any ? (member: U) => void : never
) extends (member: infer I) => void
  ? I
  : never
