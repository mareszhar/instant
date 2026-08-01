/**
 * The typed-tx types — one machinery for both runtimes (`db.tx` on the
 * client, `adminDb.tx` on the admin surface). Types the two places the
 * official chain goes untyped: `ruleParams` (schema-typed per namespace) and
 * `.link()` dot-path keys (label completes, unique fields narrow, the value
 * is typed; compiles to the official `lookup()` form on the wire).
 */
import type {
  CreateParams,
  DataAttrDef,
  UpdateParams,
} from '@instantdb/core'
import type { IdbSchema } from '../schema/defineSchema.js'
import type {
  AttrsOf,
  AttrValue,
  LinkCardinality,
  LinkLabels,
  LinkTarget,
  UniqueFieldKeys,
  WireValue,
} from '../schema/fields.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type { IdbNamespaceName } from '../schema/types.js'
import type { Expand } from '../schema/util.js'

// ==========
// op payloads

/** Options for `update`/`merge` — core's `UpdateOpts` (not exported there). */
export interface IdbTxUpdateOpts {
  upsert?: boolean | undefined
}

/** The `create` payload — required fields required, optionals optional. */
export type IdbTxCreate<
  NS extends IdbNamespaceName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = CreateParams<S, NS>

/** The `update`/`merge`-style payload — everything optional. */
export type IdbTxUpdate<
  NS extends IdbNamespaceName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = UpdateParams<S, NS>

type PlainLinkValue<Cardinality> = Cardinality extends 'one'
  ? string
  : string | readonly string[]

type LinkDotPaths<S extends IdbSchema, NS extends string> = {
  [L in LinkLabels<S, NS>]: `${L}.${UniqueFieldKeys<S, LinkTarget<S, NS, L>>}`
}[LinkLabels<S, NS>]

type LinkDotPathValue<
  S extends IdbSchema,
  NS extends string,
  P,
> = P extends `${infer L}.${infer F}`
  ? WireValue<AttrValue<AttrsOf<S, LinkTarget<S, NS, L>>[F]>>
  : never

/**
 * The `link`/`unlink` payload: plain label keys typed per cardinality, plus
 * one-hop dot-path keys over the linked namespace's unique fields —
 * `{ 'workspace.inviteCode': code }` compiles to the official `lookup()`
 * form on the wire.
 */
export type IdbTxLink<
  NS extends IdbNamespaceName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = {
  [L in LinkLabels<S, NS>]?: PlainLinkValue<LinkCardinality<S, NS, L>>
} & {
  [P in LinkDotPaths<S, NS>]?: LinkDotPathValue<S, NS, P>
}

// ==========
// ruleParams

type RequiredRuleParamKeys<RP> = {
  [K in keyof RP]: RP[K] extends DataAttrDef<any, infer R, any, any>
    ? R extends true
      ? K
      : never
    : never
}[keyof RP]

type OptionalRuleParamKeys<RP> = {
  [K in keyof RP]: RP[K] extends DataAttrDef<any, infer R, any, any>
    ? R extends false
      ? K
      : never
    : never
}[keyof RP]

type RuleParamsShape<RP> = Expand<
  { [K in RequiredRuleParamKeys<RP>]: WireValue<AttrValue<RP[K]>> } & {
    [K in OptionalRuleParamKeys<RP>]?: WireValue<AttrValue<RP[K]>>
  }
>

/**
 * The `ruleParams` payload for a namespace, typed from its collocated
 * declaration in `defineSchema` — unknown keys are TS errors; a namespace
 * with no declaration accepts none.
 */
export type IdbTxRuleParams<
  NS extends IdbNamespaceName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = NS extends keyof S['$dux']['namespaces']
  ? S['$dux']['namespaces'][NS]['ruleParams'] extends infer RP
    ? RP extends Record<string, DataAttrDef<any, any, any, any>>
      ? RuleParamsShape<RP>
      : Record<
        string,
          `IDBDUXERR_TX_RULE_PARAMS_UNDECLARED: ${NS} declares no ruleParams — declare them in i.namespace({ ruleParams })`
      >
    : never
  : never

// ==========
// the chain

/**
 * One tx step. Carries the official `__ops`/`__etype` runtime shape that
 * `transact()` consumes, so interop holds on both runtimes; dux's own
 * `transact` types its parameter as `IdbTxChunk` (the official
 * `TransactionChunk` can't be a *structural supertype* — its method params
 * are contravariant — which is exactly why the dux chain owns its own
 * narrower typing rather than re-deriving the official one).
 */
export interface IdbTxChunk<
  S extends IdbSchema = IdbRegisteredSchema,
  NS extends IdbNamespaceName<S> = IdbNamespaceName<S>,
> {
  // The official op tuple (`Op`) is not exported; this stays structurally
  // assignable to `TransactionChunk.__ops` while remaining inspectable.
  __ops: any[]
  __etype: NS
  /** Create an entity. Throws if the id already exists. */
  create: (args: IdbTxCreate<NS, S>) => IdbTxChunk<S, NS>
  /** Upsert by default; `{ upsert: false }` for strict update. */
  update: (args: IdbTxUpdate<NS, S>, opts?: IdbTxUpdateOpts) => IdbTxChunk<S, NS>
  /** Link entities — plain ids or dot-path unique-field keys. */
  link: (args: IdbTxLink<NS, S>) => IdbTxChunk<S, NS>
  /** Unlink entities — same payload shape as `link`. */
  unlink: (args: IdbTxLink<NS, S>) => IdbTxChunk<S, NS>
  /** Delete the entity and all of its links. */
  delete: () => IdbTxChunk<S, NS>
  /** Deep-merge into the current value (document-style fields). */
  merge: (args: { [attribute: string]: any }, opts?: IdbTxUpdateOpts) => IdbTxChunk<S, NS>
  /** Schema-declared rule params for this namespace. */
  ruleParams: (args: IdbTxRuleParams<NS, S>) => IdbTxChunk<S, NS>
}

export type IdbTxNamespace<
  S extends IdbSchema,
  NS extends IdbNamespaceName<S>,
> = {
  [id: string]: IdbTxChunk<S, NS>
} & {
  /** Address an entity by a unique attribute instead of its id. */
  lookup: <K extends UniqueFieldKeys<S, NS>>(
    attr: K,
    value: WireValue<AttrValue<AttrsOf<S, NS>[K]>>,
  ) => IdbTxChunk<S, NS>
}

/** The typed tx builder — `db.tx` and `adminDb.tx` share this shape. */
export type IdbTx<S extends IdbSchema = IdbRegisteredSchema> = {
  [NS in IdbNamespaceName<S>]: IdbTxNamespace<S, NS>
}

/**
 * A chunk for *any one* namespace — the type `transact`/`debugTransact` accept.
 * `IdbTxChunk<S>` defaults its `NS` to the full union, whose method params are
 * contravariant, so a chunk narrowed to one namespace (what `tx.tasks[id]…`
 * produces) wouldn't be assignable to it. The per-namespace union is: a
 * `'tasks'` chunk is exactly one of its members.
 */
export type IdbTxChunkInput<S extends IdbSchema = IdbRegisteredSchema> = {
  [NS in IdbNamespaceName<S>]: IdbTxChunk<S, NS>
}[IdbNamespaceName<S>]
