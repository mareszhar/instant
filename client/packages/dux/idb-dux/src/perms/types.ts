/**
 * The perms-domain types: the schema-aware context every callback receives,
 * the ref-path machinery, the allow/fields/bind/stage shapes, the chainable
 * builders, and the compiled `IdbPerms` output.
 *
 * The context is **entity-rooted with current unmarked** (conventions §10):
 * `e`/`ef`/`er` read the current entity (`data.*`), `eu`/`euf` the updated one
 * (`newData.*`, update only), `el`/`elf`/`elr` the linked one (`linkedData.*`,
 * link/unlink only). Action-only values exist only in the matching action
 * callback, so misusing one (`eu` in `view`) fails at the cursor.
 */
import type { DataAttrDef, InstantRules } from '@instantdb/core'
import type { IdbSchema } from '../schema/defineSchema.js'
import type {
  AttrsOf,
  AttrValue,
  FieldKeys,
  LinkLabels,
  LinkTarget,
} from '../schema/fields.js'
import type { IdbEnumFieldMarker } from '../schema/namespace.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type { IdbNamespaceName } from '../schema/types.js'
import type { Expand } from '../schema/util.js'
import type { Expr, ExprArg, ListExpr } from './ast.js'

// ==========
// field + ref resolution

/** The authoring value type of a field. */
export type FieldValue<S extends IdbSchema, NS extends string, K extends string>
  = K extends 'id' ? string
    : K extends FieldKeys<S, NS> ? AttrValue<AttrsOf<S, NS>[K]> : never

/**
 * `.conforms()` — the runtime-enum membership check ([dux-spec-perms.md §8]).
 * Mixed into a field/ref expr only when the field is a runtime enum, so it is
 * an error at the cursor anywhere else.
 */
export interface Conforms { conforms: () => Expr<boolean> }

/** Whether an attr def is a runtime enum — `[never]` guards a non-field terminal (`id`). */
type IsEnumDef<D> = [D] extends [never] ? false : D extends IdbEnumFieldMarker ? true : false

/** A field expr — gains `.conforms()` when the field is a runtime enum. */
export type FieldExpr<S extends IdbSchema, NS extends string, K extends string>
  = K extends 'id'
    ? Expr<string>
    : IsEnumDef<AttrsOf<S, NS>[K]> extends true
      ? Expr<FieldValue<S, NS, K>> & Conforms
      : Expr<FieldValue<S, NS, K>>

/** Property-access view of an entity: `id` plus every field, each a `FieldExpr`. */
export type EntityExpr<S extends IdbSchema, NS extends string> = Expand<
  { id: Expr<string> } & {
    [K in FieldKeys<S, NS>]: FieldExpr<S, NS, K>
  }
>

type RefDepth = readonly unknown[]
/** Ref-path autocomplete spans up to four link hops (spec §7), then `raw`. */
type RefMaxHops = 4
type NextRef<D extends RefDepth> = [...D, unknown]

type RefAttr<S extends IdbSchema, NS extends string> = FieldKeys<S, NS> | 'id'

/**
 * Every valid ref path from a namespace: one or more link hops ending in an
 * attribute (`'memberships.user.id'`). Capped at `RefMaxHops` so the union
 * stays tractable; deeper paths use `raw`.
 */
export type RefPath<
  S extends IdbSchema,
  NS extends string,
  D extends RefDepth = [],
> = D['length'] extends RefMaxHops
  ? never
  : {
      [L in LinkLabels<S, NS>]:
        | `${L}.${RefAttr<S, LinkTarget<S, NS, L>>}`
        | `${L}.${RefPath<S, LinkTarget<S, NS, L>, NextRef<D>>}`
    }[LinkLabels<S, NS>]

/** The value type a ref path terminates in — a list of these is what `er` returns. */
export type RefTerminal<
  S extends IdbSchema,
  NS extends string,
  P extends string,
> = P extends `${infer L}.${infer Rest}`
  ? L extends LinkLabels<S, NS>
    ? Rest extends RefAttr<S, LinkTarget<S, NS, L>>
      ? FieldValue<S, LinkTarget<S, NS, L>, Rest>
      : RefTerminal<S, LinkTarget<S, NS, L>, Rest>
    : never
  : never

/** The attr def a ref path terminates in — `never` for an `id` terminal (not a field). */
export type RefTerminalDef<
  S extends IdbSchema,
  NS extends string,
  P extends string,
> = P extends `${infer L}.${infer Rest}`
  ? L extends LinkLabels<S, NS>
    ? Rest extends FieldKeys<S, LinkTarget<S, NS, L>>
      ? AttrsOf<S, LinkTarget<S, NS, L>>[Rest]
      : Rest extends RefAttr<S, LinkTarget<S, NS, L>>
        ? never
        : RefTerminalDef<S, LinkTarget<S, NS, L>, Rest>
    : never
  : never

/** A ref expr — gains `.conforms()` when its terminal is a runtime enum. */
export type RefExpr<S extends IdbSchema, NS extends string, P extends string>
  = IsEnumDef<RefTerminalDef<S, NS, P>> extends true
    ? ListExpr<RefTerminal<S, NS, P>> & Conforms
    : ListExpr<RefTerminal<S, NS, P>>

/** Auth refs start from `$users`, spelled `$user.`-prefixed (Instant's form). */
export type AuthRefPath<S extends IdbSchema> = `$user.${RefPath<S, '$users'>}`
type AuthRefTerminal<S extends IdbSchema, P extends string>
  = P extends `$user.${infer Rest}` ? RefTerminal<S, '$users', Rest> : never

/** An auth-ref expr — gains `.conforms()` when its terminal is a runtime enum. */
export type AuthRefExpr<S extends IdbSchema, P extends string>
  = P extends `$user.${infer Rest}`
    ? IsEnumDef<RefTerminalDef<S, '$users', Rest>> extends true
      ? ListExpr<AuthRefTerminal<S, P>> & Conforms
      : ListExpr<AuthRefTerminal<S, P>>
    : ListExpr<AuthRefTerminal<S, P>>

// ==========
// ruleParams resolution

type RuleParamDefs<S extends IdbSchema, NS extends string>
  = NS extends keyof S['$dux']['namespaces']
    ? S['$dux']['namespaces'][NS]['ruleParams'] extends infer RP
      ? RP extends Record<string, DataAttrDef<any, any, any, any>>
        ? RP
        : {}
      : {}
    : {}

type RuleParamKeys<S extends IdbSchema, NS extends string> = keyof RuleParamDefs<S, NS> & string
type RuleParamValue<S extends IdbSchema, NS extends string, K extends string>
  = K extends keyof RuleParamDefs<S, NS> ? AttrValue<RuleParamDefs<S, NS>[K]> : never

// ==========
// the fixed CEL globals

/** The authenticated user — a `$users` entity, plus `id`, read as `auth.*`. */
export type AuthExpr<S extends IdbSchema>
  = '$users' extends IdbNamespaceName<S>
    ? EntityExpr<S, '$users'>
    : { id: Expr<string> }

/** Request metadata always in scope (`request.*`). */
export interface RequestExpr {
  time: Expr<Date>
  ip: Expr<string>
  origin: Expr<string>
}

/** The create/update request: the common metadata plus the modified-field set. */
export interface WriteRequestExpr extends RequestExpr {
  modifiedFields: ListExpr<string>
}

/** Functional composition — best for nested or n-ary rules (spec §8). */
export interface Fns {
  and: (...exprs: ExprArg<boolean>[]) => Expr<boolean>
  or: (...exprs: ExprArg<boolean>[]) => Expr<boolean>
  not: (expr: ExprArg<boolean>) => Expr<boolean>
  eq: <T>(a: ExprArg<T>, b: ExprArg<T>) => Expr<boolean>
  neq: <T>(a: ExprArg<T>, b: ExprArg<T>) => Expr<boolean>
  gt: <T>(a: ExprArg<T>, b: ExprArg<T>) => Expr<boolean>
  gte: <T>(a: ExprArg<T>, b: ExprArg<T>) => Expr<boolean>
  lt: <T>(a: ExprArg<T>, b: ExprArg<T>) => Expr<boolean>
  lte: <T>(a: ExprArg<T>, b: ExprArg<T>) => Expr<boolean>
  in: <T>(item: ExprArg<T>, list: readonly ExprArg<T>[] | ListExpr<T>) => Expr<boolean>
  contains: <T>(list: readonly ExprArg<T>[] | ListExpr<T>, item: ExprArg<T>) => Expr<boolean>
  size: (value: ListExpr<any> | ExprArg<string>) => Expr<number>
  list: <T>(...values: ExprArg<T>[]) => ListExpr<T>
  str: (value: ExprArg<string>) => Expr<string>
  num: (value: ExprArg<number>) => Expr<number>
  bool: (value: ExprArg<boolean>) => Expr<boolean>
  null: () => Expr<null>
}

/** Configured rate-limit buckets, used as `rl.bucket.limit(key)`. */
export type RateLimitCtx<RL> = {
  [K in keyof RL]: { limit: (key: ExprArg<unknown>) => Expr<boolean> }
}

/** How a bucket refills — mirrors Instant's `$rateLimits` refill shape (spec §11). */
export interface IdbPermsRateLimitRefill {
  amount?: number
  period?: string
  type?: 'interval' | 'greedy'
}

/** One token-bucket limit. */
export interface IdbPermsRateLimitLimit {
  capacity: number
  refill?: IdbPermsRateLimitRefill
}

/** A named rate-limit bucket — used in rules via `rl.<name>.limit(key)`. */
export interface IdbPermsRateLimit {
  limits: IdbPermsRateLimitLimit[]
}

/** The `$rateLimits` configuration map (structurally Instant's shape). */
export type IdbPermsRateLimits = Record<string, IdbPermsRateLimit>

// ==========
// contexts

/** The common context — every callback's baseline (spec §6). */
export interface CommonCtx<
  S extends IdbSchema,
  NS extends string,
  St,
  Bn,
  RL,
> {
  auth: AuthExpr<S>
  ar: <P extends AuthRefPath<S>>(path: P) => AuthRefExpr<S, P>
  e: EntityExpr<S, NS>
  ef: <K extends FieldKeys<S, NS>>(key: K) => FieldExpr<S, NS, K>
  er: <P extends RefPath<S, NS>>(path: P) => RefExpr<S, NS, P>
  rp: <K extends RuleParamKeys<S, NS>>(key: K) => Expr<RuleParamValue<S, NS, K>>
  req: RequestExpr
  f: Fns
  ops: Fns
  raw: <T = boolean>(cel: string) => Expr<T>
  rl: RateLimitCtx<RL>
  s: St
  b: Bn
}

/** Create/update context — common plus `request.modifiedFields`. */
export type WriteCtx<S extends IdbSchema, NS extends string, St, Bn, RL>
  = Omit<CommonCtx<S, NS, St, Bn, RL>, 'req'> & { req: WriteRequestExpr }

/** Update context — write context plus the updated entity (`newData.*`). */
export type UpdateCtx<S extends IdbSchema, NS extends string, St, Bn, RL>
  = WriteCtx<S, NS, St, Bn, RL> & {
    eu: EntityExpr<S, NS>
    euf: <K extends FieldKeys<S, NS>>(key: K) => FieldExpr<S, NS, K>
  }

/** Link/unlink context — common plus the linked entity, typed per link label. */
export type LinkCtx<S extends IdbSchema, NS extends string, L extends string, St, Bn, RL>
  = CommonCtx<S, NS, St, Bn, RL> & {
    el: EntityExpr<S, LinkTarget<S, NS, L>>
    elf: <K extends FieldKeys<S, LinkTarget<S, NS, L>>>(key: K) => FieldExpr<S, LinkTarget<S, NS, L>, K>
    elr: <P extends RefPath<S, LinkTarget<S, NS, L>>>(path: P) => RefExpr<S, LinkTarget<S, NS, L>, P>
  }

/** The loose context for `.defaults` — no namespace, so reads are string-keyed. */
export interface DefaultCtx<S extends IdbSchema, St, Bn, RL> {
  auth: AuthExpr<S>
  ar: <P extends AuthRefPath<S>>(path: P) => AuthRefExpr<S, P>
  ef: (key: string) => Expr<unknown>
  er: (path: string) => ListExpr<unknown>
  rp: (key: string) => Expr<unknown>
  req: RequestExpr
  f: Fns
  ops: Fns
  raw: <T = boolean>(cel: string) => Expr<T>
  rl: RateLimitCtx<RL>
  s: St
  b: Bn
}

/** The narrow context for `.attrs` — no entity, no refs (spec §5). */
export interface AttrsCtx<S extends IdbSchema, RL> {
  auth: AuthExpr<S>
  ar: <P extends AuthRefPath<S>>(path: P) => AuthRefExpr<S, P>
  req: RequestExpr
  f: Fns
  ops: Fns
  raw: <T = boolean>(cel: string) => Expr<T>
  rl: RateLimitCtx<RL>
}

// ==========
// action scopes — what stageFor/bindFor accumulate

/** The four whole-entity actions a `stageFor`/`bindFor` can target. */
export type EntityAction = 'view' | 'create' | 'update' | 'delete'
/** The two link-label actions. */
export type LinkAction = 'link' | 'unlink'

/** One action's accumulated action-specific staged (`s`) and bind (`b`) names. */
export interface Scope { s: object, b: object }
interface EmptyScope { s: {}, b: {} }

/**
 * The action-specific names a namespace builder has accumulated — threaded
 * through the builder's type so each appears *only* in its own action's
 * callback. Whole-entity actions hold one scope; link/unlink hold one per label.
 */
export interface ActionScopes {
  view: Scope
  create: Scope
  update: Scope
  delete: Scope
  link: Record<string, Scope>
  unlink: Record<string, Scope>
}

/** The starting scopes — nothing action-specific yet. */
export interface EmptyScopes {
  view: EmptyScope
  create: EmptyScope
  update: EmptyScope
  delete: EmptyScope
  link: {}
  unlink: {}
}

type LinkScopeOf<AX extends ActionScopes, D extends LinkAction, L extends string>
  = L extends keyof AX[D] ? AX[D][L] : EmptyScope

interface StageScope<Sc extends Scope, O> { s: Expand<Sc['s'] & O>, b: Sc['b'] }
interface BindScope<Sc extends Scope, O> { s: Sc['s'], b: Expand<Sc['b'] & O> }

// The full ActionScopes is rebuilt explicitly (rather than Omit + re-add) so the
// result is statically known to keep all six keys, satisfying the constraint
// even while `A` is still a generic.
interface AddStage<AX extends ActionScopes, A extends EntityAction, O> {
  view: A extends 'view' ? StageScope<AX['view'], O> : AX['view']
  create: A extends 'create' ? StageScope<AX['create'], O> : AX['create']
  update: A extends 'update' ? StageScope<AX['update'], O> : AX['update']
  delete: A extends 'delete' ? StageScope<AX['delete'], O> : AX['delete']
  link: AX['link']
  unlink: AX['unlink']
}
interface AddBind<AX extends ActionScopes, A extends EntityAction, O> {
  view: A extends 'view' ? BindScope<AX['view'], O> : AX['view']
  create: A extends 'create' ? BindScope<AX['create'], O> : AX['create']
  update: A extends 'update' ? BindScope<AX['update'], O> : AX['update']
  delete: A extends 'delete' ? BindScope<AX['delete'], O> : AX['delete']
  link: AX['link']
  unlink: AX['unlink']
}
interface AddLinkStage<AX extends ActionScopes, D extends LinkAction, L extends string, O> {
  view: AX['view']
  create: AX['create']
  update: AX['update']
  delete: AX['delete']
  link: D extends 'link' ? AX['link'] & { [P in L]: StageScope<LinkScopeOf<AX, 'link', L>, O> } : AX['link']
  unlink: D extends 'unlink' ? AX['unlink'] & { [P in L]: StageScope<LinkScopeOf<AX, 'unlink', L>, O> } : AX['unlink']
}
interface AddLinkBind<AX extends ActionScopes, D extends LinkAction, L extends string, O> {
  view: AX['view']
  create: AX['create']
  update: AX['update']
  delete: AX['delete']
  link: D extends 'link' ? AX['link'] & { [P in L]: BindScope<LinkScopeOf<AX, 'link', L>, O> } : AX['link']
  unlink: D extends 'unlink' ? AX['unlink'] & { [P in L]: BindScope<LinkScopeOf<AX, 'unlink', L>, O> } : AX['unlink']
}

/** The context a whole-entity action callback (and its `stageFor`/`bindFor`) sees. */
export type ActionCtx<S extends IdbSchema, NS extends string, St, Bn, RL, A extends EntityAction>
  = A extends 'update'
    ? UpdateCtx<S, NS, St, Bn, RL>
    : A extends 'create'
      ? WriteCtx<S, NS, St, Bn, RL>
      : CommonCtx<S, NS, St, Bn, RL>

// ==========
// allow / fields / bind / stage shapes

/** A rule value: a boolean, an expression, or a callback returning one. */
export type Rule<Ctx> = boolean | Expr<boolean> | ((ctx: Ctx) => boolean | Expr<boolean>)

/**
 * The allow block for a namespace. Each action's callback sees the common
 * scope plus that action's `stageFor`/`bindFor` names (and, for link/unlink,
 * the per-label ones) — so action-specific aliases resolve only where they
 * make sense.
 */
export interface AllowBlock<S extends IdbSchema, NS extends string, St, Bn, RL, AX extends ActionScopes = EmptyScopes> {
  view?: Rule<CommonCtx<S, NS, St & AX['view']['s'], Bn & AX['view']['b'], RL>>
  create?: Rule<WriteCtx<S, NS, St & AX['create']['s'], Bn & AX['create']['b'], RL>>
  update?: Rule<UpdateCtx<S, NS, St & AX['update']['s'], Bn & AX['update']['b'], RL>>
  delete?: Rule<CommonCtx<S, NS, St & AX['delete']['s'], Bn & AX['delete']['b'], RL>>
  link?: {
    [L in LinkLabels<S, NS>]?: Rule<LinkCtx<S, NS, L, St & LinkScopeOf<AX, 'link', L>['s'], Bn & LinkScopeOf<AX, 'link', L>['b'], RL>>
  }
  unlink?: {
    [L in LinkLabels<S, NS>]?: Rule<LinkCtx<S, NS, L, St & LinkScopeOf<AX, 'unlink', L>['s'], Bn & LinkScopeOf<AX, 'unlink', L>['b'], RL>>
  }
}

export type AllowInput<S extends IdbSchema, NS extends string, St, Bn, RL, AX extends ActionScopes = EmptyScopes>
  = AllowBlock<S, NS, St, Bn, RL, AX> | ((ctx: CommonCtx<S, NS, St, Bn, RL>) => AllowBlock<S, NS, St, Bn, RL, AX>)

/** Field-level rules — every field except `id`. */
export type FieldsBlock<S extends IdbSchema, NS extends string> = {
  [F in Exclude<FieldKeys<S, NS>, 'id'>]?: boolean | Expr<boolean>
}

export type FieldsInput<S extends IdbSchema, NS extends string, St, Bn, RL>
  = FieldsBlock<S, NS> | ((ctx: CommonCtx<S, NS, St, Bn, RL>) => FieldsBlock<S, NS>)

/** A stage/bind callback returns named expressions. */
export type NameObj = Record<string, Expr<any>>

/**
 * Maps duplicate names (already in `Existing`) to a diagnostic and leaves
 * valid names untouched (intersection identity), so a clash lands on the
 * offending key with an actionable message.
 */
export type NoDuplicateNames<O, Existing> = {
  [K in keyof O]: K extends keyof Existing
    ? `IDBDUXERR_PERMS_DUPLICATE_NAME: ${K & string} is already defined — use .overrideStage/.overrideBind to replace it`
    : unknown
}

// ==========
// the default allow block (loose, with $default)

export interface DefaultAllowBlock<S extends IdbSchema, St, Bn, RL> {
  $default?: Rule<DefaultCtx<S, St, Bn, RL>>
  view?: Rule<DefaultCtx<S, St, Bn, RL>>
  create?: Rule<DefaultCtx<S, St, Bn, RL>>
  update?: Rule<DefaultCtx<S, St, Bn, RL>>
  delete?: Rule<DefaultCtx<S, St, Bn, RL>>
}

export type DefaultAllowInput<S extends IdbSchema, St, Bn, RL>
  = DefaultAllowBlock<S, St, Bn, RL> | ((ctx: DefaultCtx<S, St, Bn, RL>) => DefaultAllowBlock<S, St, Bn, RL>)

// ==========
// builders

/** The namespace builder — `ns` in `.namespaces({})` (spec §4). */
export interface NsBuilder<
  S extends IdbSchema,
  NS extends string,
  St = {},
  Bn = {},
  RL = {},
  AX extends ActionScopes = EmptyScopes,
> {
  stage: <O extends NameObj>(
    fn: (ctx: CommonCtx<S, NS, St, Bn, RL>) => O & NoDuplicateNames<O, St & Bn>,
  ) => NsBuilder<S, NS, Expand<St & O>, Bn, RL, AX>
  overrideStage: <O extends NameObj>(
    fn: (ctx: CommonCtx<S, NS, St, Bn, RL>) => O,
  ) => NsBuilder<S, NS, Expand<St & O>, Bn, RL, AX>
  bind: <O extends NameObj>(
    fn: (ctx: CommonCtx<S, NS, St, Bn, RL>) => O & NoDuplicateNames<O, St & Bn>,
  ) => NsBuilder<S, NS, St, Expand<Bn & O>, RL, AX>
  overrideBind: <O extends NameObj>(
    fn: (ctx: CommonCtx<S, NS, St, Bn, RL>) => O,
  ) => NsBuilder<S, NS, St, Expand<Bn & O>, RL, AX>
  /**
   * Action-specific staged values — authoring-only, visible only in the
   * matching action's callback. For link/unlink, pass the label too (spec §9).
   */
  stageFor: {
    <A extends EntityAction, O extends NameObj>(
      action: A,
      fn: (ctx: ActionCtx<S, NS, St & AX[A]['s'], Bn & AX[A]['b'], RL, A>) => O & NoDuplicateNames<O, St & Bn>,
    ): NsBuilder<S, NS, St, Bn, RL, AddStage<AX, A, O>>
    <D extends LinkAction, L extends LinkLabels<S, NS>, O extends NameObj>(
      dir: D,
      label: L,
      fn: (ctx: LinkCtx<S, NS, L, St & LinkScopeOf<AX, D, L>['s'], Bn & LinkScopeOf<AX, D, L>['b'], RL>) => O & NoDuplicateNames<O, St & Bn>,
    ): NsBuilder<S, NS, St, Bn, RL, AddLinkStage<AX, D, L, O>>
  }
  /**
   * Action-specific bind aliases — emitted into the namespace `bind` block
   * (the backend evaluates each only where referenced), visible only in the
   * matching action's callback (spec §9).
   */
  bindFor: {
    <A extends EntityAction, O extends NameObj>(
      action: A,
      fn: (ctx: ActionCtx<S, NS, St & AX[A]['s'], Bn & AX[A]['b'], RL, A>) => O & NoDuplicateNames<O, St & Bn>,
    ): NsBuilder<S, NS, St, Bn, RL, AddBind<AX, A, O>>
    <D extends LinkAction, L extends LinkLabels<S, NS>, O extends NameObj>(
      dir: D,
      label: L,
      fn: (ctx: LinkCtx<S, NS, L, St & LinkScopeOf<AX, D, L>['s'], Bn & LinkScopeOf<AX, D, L>['b'], RL>) => O & NoDuplicateNames<O, St & Bn>,
    ): NsBuilder<S, NS, St, Bn, RL, AddLinkBind<AX, D, L, O>>
  }
  allow: (input: AllowInput<S, NS, St, Bn, RL, AX>) => NsBuilder<S, NS, St, Bn, RL, AX>
  fields: (input: FieldsInput<S, NS, St, Bn, RL>) => NsBuilder<S, NS, St, Bn, RL, AX>
}

/** The defaults builder — `d` in `.defaults()` (spec §5). */
export interface DefaultsBuilder<
  S extends IdbSchema,
  St = {},
  Bn = {},
  RL = {},
> {
  stage: <O extends NameObj>(
    fn: (ctx: DefaultCtx<S, St, Bn, RL>) => O & NoDuplicateNames<O, St & Bn>,
  ) => DefaultsBuilder<S, Expand<St & O>, Bn, RL>
  bind: <O extends NameObj>(
    fn: (ctx: DefaultCtx<S, St, Bn, RL>) => O & NoDuplicateNames<O, St & Bn>,
  ) => DefaultsBuilder<S, St, Expand<Bn & O>, RL>
  allow: (input: DefaultAllowInput<S, St, Bn, RL>) => DefaultsBuilder<S, St, Bn, RL>
  /**
   * Phantom carriers so `.defaults` can infer the accumulated maps.
   * @internal
   */
  readonly __staged?: St
  readonly __binds?: Bn
}

/** The attrs builder — create-only (spec §5). */
export interface AttrsBuilder<S extends IdbSchema, RL = {}> {
  allow: (input:
    | { create?: boolean | Expr<boolean> }
    | ((ctx: AttrsCtx<S, RL>) => { create?: boolean | Expr<boolean> })) => AttrsBuilder<S, RL>
}

type DefaultStagedOf<D> = D extends DefaultsBuilder<any, infer St, any, any> ? St : {}
type DefaultBindsOf<D> = D extends DefaultsBuilder<any, any, infer Bn, any> ? Bn : {}

/** The `.namespaces({})` input — keys are schema namespaces, callbacks build each. */
export type NamespacesInput<S extends IdbSchema, St, Bn, RL> = {
  [NS in IdbNamespaceName<S>]?: (
    ns: NsBuilder<S, NS, St, Bn, RL>,
  ) => NsBuilder<S, NS, any, any, RL, any>
}

/** The top-level builder returned by `definePerms` (spec §3). */
export interface PermsBuilder<
  S extends IdbSchema,
  St = {},
  Bn = {},
  RL = {},
> {
  attrs: (fn: (a: AttrsBuilder<S, RL>) => AttrsBuilder<S, RL>) => PermsBuilder<S, St, Bn, RL>
  defaults: <D extends DefaultsBuilder<S, any, any, RL>>(
    fn: (d: DefaultsBuilder<S, {}, {}, RL>) => D,
  ) => PermsBuilder<S, DefaultStagedOf<D>, DefaultBindsOf<D>, RL>
  rateLimits: <R extends IdbPermsRateLimits>(config: R) => PermsBuilder<S, St, Bn, R>
  namespaces: (map: NamespacesInput<S, St, Bn, RL>) => PermsBuilder<S, St, Bn, RL>
  compile: () => IdbPerms<S>
}

// ==========
// output

/**
 * The compiled rules object — plain CEL strings, structurally assignable to
 * the official `InstantRules<S>` (so CLI push and platform `pushPerms` accept
 * it unchanged).
 */
export type IdbPerms<S extends IdbSchema = IdbRegisteredSchema> = InstantRules<S>
