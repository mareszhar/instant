/**
 * Schema-derived field and link helpers, shared by the query and tx layers.
 * Internal — the public surface exposes them only through `Idb*` types.
 *
 * Field-subset keys are detected by inferring the relevant `DataAttrDef`
 * type param (core's UniqueKeys/IndexedKeys pattern) — `IsUnique`/`IsIndexed`
 * are not structural properties, so assignability tests cannot see them.
 */
import type { DataAttrDef } from '@instantdb/core'
import type { IdbSchema } from './defineSchema.js'

export type AttrsOf<S extends IdbSchema, NS extends string> = S['entities'][NS]['attrs']
export type LinksOf<S extends IdbSchema, NS extends string> = S['entities'][NS]['links']

export type FieldKeys<S extends IdbSchema, NS extends string> = keyof AttrsOf<S, NS> & string
export type LinkLabels<S extends IdbSchema, NS extends string> = keyof LinksOf<S, NS> & string

export type LinkTarget<
  S extends IdbSchema,
  NS extends string,
  L extends string,
> = LinksOf<S, NS>[L] extends { entityName: infer T extends string } ? T : never

export type LinkCardinality<
  S extends IdbSchema,
  NS extends string,
  L extends string,
> = LinksOf<S, NS>[L] extends { cardinality: infer C } ? C : never

export type AttrValue<A> = A extends DataAttrDef<infer V, any, any, any> ? V : never

/** The wire form of a field value — `i.date()` fields travel as string | number. */
export type WireValue<V> = V extends Date ? string | number | Date : V

export type IndexedFieldKeys<S extends IdbSchema, NS extends string> = {
  [K in keyof AttrsOf<S, NS>]: AttrsOf<S, NS>[K] extends DataAttrDef<any, any, infer I, any>
    ? I extends true
      ? K & string
      : never
    : never
}[keyof AttrsOf<S, NS>]

export type UniqueFieldKeys<S extends IdbSchema, NS extends string> = {
  [K in keyof AttrsOf<S, NS>]: AttrsOf<S, NS>[K] extends DataAttrDef<any, any, any, infer U>
    ? U extends true
      ? K & string
      : never
    : never
}[keyof AttrsOf<S, NS>]

export type PrimitiveFieldKeys<S extends IdbSchema, NS extends string> = {
  [K in keyof AttrsOf<S, NS>]: AttrsOf<S, NS>[K] extends DataAttrDef<infer V, any, any, any>
    ? [V] extends [string | number | boolean]
        ? K & string
        : never
    : never
}[keyof AttrsOf<S, NS>]
