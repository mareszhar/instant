/**
 * `@mszr/idb-dux/perms` — typed CEL authoring.
 *
 * `definePerms` and the expression/context machinery that compiles to the
 * plain rules object Instant already accepts. Authoring-only: no client
 * runtime, never bundled into client JS.
 *
 * Spec: `../../../docs/dux-spec-perms.md`.
 */
export type { Expr, ExprArg, ItemExpr, ListExpr } from './ast.js'
export { definePerms } from './builder.js'
export type {
  ActionCtx,
  AllowBlock,
  AttrsBuilder,
  AuthExpr,
  CommonCtx,
  Conforms,
  DefaultsBuilder,
  EntityAction,
  EntityExpr,
  Fns,
  IdbPerms,
  LinkAction,
  LinkCtx,
  NsBuilder,
  PermsBuilder,
  RateLimitCtx,
  RefPath,
  RefTerminal,
  RequestExpr,
  Rule,
  UpdateCtx,
  WriteCtx,
  WriteRequestExpr,
} from './types.js'
