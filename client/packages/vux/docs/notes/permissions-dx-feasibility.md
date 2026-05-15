updated: 2026-05-10
status: proposed

# Permissions DX Feasibility (`@mszr/idb-vux`)

## Problem statement

Instant permissions are powerful, but day-to-day authoring is costly:

- rules are raw strings
- dot-path refs are stringly-typed
- no schema-aware IntelliSense
- no compile-time validation for many mistakes
- low confidence when refactoring schema names

For a UX/DX-first Vux SDK, this is a high-leverage gap.

## Target outcome

Ship an additive permissions authoring layer that:

1. stays fully compatible with native Instant `instant.perms.ts`
2. compiles to plain CEL strings
3. provides schema-aware path/type guidance
4. validates action-context usage (`data`, `newData`, `linkedData`, `ruleParams`)
5. keeps generated output easy to inspect and debug

## Non-goals (phase 1)

- do not replace Instant's runtime permission engine
- do not invent a new server DSL
- do not require custom CLI behavior to deploy perms
- do not guarantee semantic correctness of arbitrary CEL beyond supported helpers

## Recommended package surface

Add a new subpath export:

- `@mszr/idb-vux/permissions`

Rationale:

- keeps the core runtime package focused
- allows fast iteration without destabilizing query/runtime APIs
- aligns with existing additive strategy (`defineQuery`, `useQueryX`)

## API design direction

### Naming convention

Use a namespaced builder object, with helper names prefixed by `$`:

- avoids Vue `ref` ambiguity (`$ref` instead of `ref`)
- avoids reserved words (`$in` instead of `in`)
- keeps permissions expressions visually distinct from app code

Recommended entrypoint name:

- `definePermissions<Schema>()`

### High-level shape

```ts
import type { AppSchema } from './instant.schema'
import { definePermissions } from '@mszr/idb-vux/permissions'

const p = definePermissions<AppSchema>()

const rules = p.rules({
  $default: p.entity({
    allow: {
      $default: p.$false(),
    },
  }),
  workspaces: p.entity({
    bind: {
      isMember: p.$in(p.$auth.id(), p.$data.ref('memberships.user.id')),
      hasInviteCode: p.$and(
        p.$neq(p.$ruleParam('inviteCode'), p.$null()),
        p.$eq(p.$ruleParam('inviteCode'), p.$data.field('inviteCode')),
      ),
    },
    allow: {
      view: p.$or(p.$var('isMember'), p.$var('hasInviteCode')),
      create: p.$neq(p.$auth.id(), p.$null()),
      update: p.$var('isMember'),
      delete: p.$var('isMember'),
    },
  }),
})

export default rules
```

Key principle: helper calls return typed expression nodes that finally emit CEL strings.

## Proposed helper families

### Context values

- `$auth.id()`, `$auth.email()`, `$auth.ref(path)`
- `$data.field(path)`, `$data.ref(path)`
- `$newData.field(path)`
- `$linkedData.field(path)`
- `$ruleParam(name)`
- `$request.modifiedFields()`, `$request.time()`, `$request.origin()`, `$request.ip()`

### Boolean and comparison

- `$and(...)`, `$or(...)`, `$not(expr)`
- `$eq(a, b)`, `$neq(a, b)`
- `$gt(a, b)`, `$gte(a, b)`, `$lt(a, b)`, `$lte(a, b)`

### Collection/string helpers

- `$in(item, listExpr)`
- `$contains(listExpr, item)`
- `$size(valueExpr)` -> emits `size(...)`
- `$all(listExpr, lambda)` -> emits CEL `.all(...)`
- `$any(listExpr, lambda)` -> emits CEL `.exists(...)`/`any` equivalent

### Literals and reuse

- `$str('...')`, `$num(1)`, `$bool(true)`, `$null()`
- `$var('bindName')` to reference bind aliases safely

## Type-safety opportunities

### 1) Schema path checking

Validate these at compile-time when possible:

- `data.ref('workspace.memberships.user.id')`
- `data.field('inviteCode')`
- `auth.ref('$user.memberships.workspace.id')`

This is similar in spirit to `defineQuery` path validation in the X query APIs.

### 2) Action-context checking

Catch invalid usage:

- forbid `$newData` in `view`/`create`/`delete`
- forbid `$linkedData` outside `link`/`unlink`
- allow `request.modifiedFields` only where valid

### 3) Namespace operation constraints

For link/unlink blocks, validate relation labels against schema link labels.

### 4) Known CEL function guardrails

Prefer explicit helpers for common CEL functions (`size`, membership checks, boolean composition) so users avoid ad hoc string mistakes.

## Compilation strategy

Each helper creates a tiny AST node:

- `kind`
- `children`
- optional metadata for type/context validation

Renderer turns AST into CEL string:

- deterministic formatting
- minimal parentheses rules
- string escaping

Output type remains:

- `InstantRules<Schema>`

So adoption requires no backend changes.

## Migration posture

Support mixed usage from day one:

- existing raw strings continue to work
- builders can be adopted per-namespace incrementally

Example:

```ts
const rules = p.rules({
  todos: p.entity({
    allow: {
      view: 'auth.id != null', // raw string kept
      create: p.$neq(p.$auth.id(), p.$null()), // helper used
    },
  }),
})
```

## Phased implementation plan

### Phase 1: minimal viable DX

- add `definePermissions`
- add core bool/comparison/in/ref helpers
- add typed `data.ref`, `auth.ref`, `data.field` path checks
- emit plain `InstantRules`

Exit criteria:

- common workspace/member rules can be written without raw dot-path strings
- compile-time catches wrong path keys in helper APIs

### Phase 2: action-aware validation

- action context typing (`view/create/update/delete/link/unlink`)
- `newData` and `linkedData` guardrails
- link-label validation

Exit criteria:

- invalid context usage fails type-check
- link block typos fail type-check

### Phase 3: power helpers and linting

- request helper coverage (`modifiedFields`, `time`, etc.)
- optional debug printer (AST + rendered CEL)
- optional ESLint rules/codemod for migration

Exit criteria:

- real-world demo perms authored mostly with helpers
- measurable reduction in raw CEL string surface

## Risks and tradeoffs

1. Type complexity creep

- deep conditional types can become heavy
- mitigation: keep helpers narrow and composable first

2. False confidence risk

- type-valid rules can still be logically wrong
- mitigation: generated CEL preview and docs patterns

3. Learning curve

- new helper vocabulary needed
- mitigation: direct mapping docs: helper -> emitted CEL

4. Maintenance overhead

- CEL surface area can evolve
- mitigation: define explicit supported helper set and version it

## Test strategy

- `*.types.ts` compile tests for path validation and context gating
- unit tests for renderer output snapshots
- integration fixture that pushes generated perms and validates expected allow/deny behavior

## Feasibility assessment

Overall feasibility: **high**.

Reasons:

- permissions remain plain output strings
- no server/runtime protocol changes needed
- strong precedent in this SDK for typed additive authoring layers (`defineQuery`)
- implementation can be incremental and safe

## Recommendation

This initiative is worth prioritizing before broader demo polish work because it improves safety and maintainability for every future app/demo using `@mszr/idb-vux`.
