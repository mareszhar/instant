updated: 2026-06-17
status: spec — contracts are binding; implementation approaches are proposals in their service

# dux spec — `/perms`

The typed permissions authoring layer. The goal is not to replace InstantDB permissions — it is a TypeScript authoring API that feels like TypeScript, validates against your schema, and compiles to the same plain rules object Instant already accepts.

Conventions: [dux-conventions.md](./dux-conventions.md) (esp. [§10 Perms vocabulary](./dux-conventions.md#10-perms-vocabulary)) · Principles: [dux-vision.md §2](./dux-vision.md#2-design-principles)

## Implementation status

| Phase | Scope | Global phase | Status |
|---|---|---|---|
| P1 | Expression AST + CEL renderer + the compile pipeline | 8 | ☑ complete |
| P2 | Common context + core builders (`.stage`/`.bind`/`.allow`/`.fields`, defaults, overrides) | 8 | ☑ complete |
| P3 | Expression breadth: list methods, functional helpers, `raw` | 8 | ☑ complete |
| P4 | Action-specific contexts (`eu`/`el`/`modifiedFields` per action; `stageFor`/`bindFor`) | 8 | ☑ complete |
| P5 | `.attrs`, `$rateLimits`, runtime diagnostics, compat-target tests | 8 | ☑ complete |
| P6 | `.conforms()` — DRY runtime-enum membership enforcement ([§8](#8-expression-api)) | 8 | ☑ complete |

Details: [§14 Phased implementation roadmap](#14-phased-implementation-roadmap).

- [1. Goals](#1-goals)
- [2. Package surface and entrypoints](#2-package-surface-and-entrypoints)
- [3. Authoring shape](#3-authoring-shape)
- [4. The namespace pipeline](#4-the-namespace-pipeline)
- [5. Special builders](#5-special-builders)
- [6. The context object](#6-the-context-object)
- [7. Entity and ref API](#7-entity-and-ref-api)
- [8. Expression API](#8-expression-api)
- [9. Action-specific stage and bind](#9-action-specific-stage-and-bind)
- [10. Output](#10-output)
- [11. Rate limits](#11-rate-limits)
- [12. Validation](#12-validation)
- [13. Full example and implementation notes](#13-full-example-and-implementation-notes)
- [14. Phased implementation roadmap](#14-phased-implementation-roadmap)

---

## 1. Goals

1. Compile to ordinary InstantDB permission rules.
2. Keep the generated output inspectable: CEL strings in the final object.
3. Make common perms feel like TypeScript, not string assembly.
4. Provide schema-aware IntelliSense for namespaces, fields, link labels, and ref paths.
5. Validate common CEL footguns at author time.
6. Support escape hatches without making unsafety the default path.
7. One mental model: the same `namespace`/`entity`/`field`/`ref` vocabulary as schema and queries — users never juggle a CEL dialect.

## 2. Package surface and entrypoints

```ts
import { definePerms } from '@mszr/idb-dux/perms'
```

`/perms` is its own subpath because it has no client runtime behavior (it only helps author `instant.perms.ts`), it should never be bundled into client JS, and its type machinery is heavy enough that it must not slow the main package's TS experience.

### Type-only (via registration)

With the schema registered ([conventions §7](./dux-conventions.md#7-schema-registration)), no generic is needed. Use this when the schema value isn't available or only TypeScript validation is wanted:

```ts
import { definePerms } from '@mszr/idb-dux/perms'

export default definePerms() // registered schema; definePerms<OtherSchema>() for explicit
  .namespaces({
    tasks: ns => ns.allow({
      view: true,
    }),
  })
  .compile()
```

- full TypeScript IntelliSense and validation
- no runtime schema validation

### Runtime schema (preferred)

```ts
import { definePerms } from '@mszr/idb-dux/perms'
import { schema } from './instant.schema'

export default definePerms(schema)
  .namespaces({
    tasks: ns => ns.allow({
      view: true,
    }),
  })
  .compile()
```

- all type-only benefits
- runtime validation for namespace names, field names, link labels, and ref paths
- better diagnostics and dev-time assertions

## 3. Authoring shape

```ts
export default definePerms(schema)
  .attrs(a => a.allow({ create: false }))
  .defaults(d => d
    .bind(({ auth }) => ({
      isSignedIn: auth.id.neq(null),
    }))
    .allow({ $default: false }))
  .namespaces({
    workspaces: ns => ns
      .stage(({ rp, e }) => ({
        inviteCode: rp('inviteCode'),
        inviteMatches: rp('inviteCode').eq(e.inviteCode),
      }))
      .bind(({ auth, er, s }) => ({
        isMember: er('memberships.user.id').contains(auth.id),
        hasInviteCode: s.inviteCode.neq(null).and(s.inviteMatches),
      }))
      .allow(({ b }) => ({
        view: b.isMember.or(b.hasInviteCode),
        create: b.isSignedIn,
        update: b.isMember,
        delete: b.isMember,
      })),
  })
  .compile()
```

Design notes:

- `.attrs()` and `.defaults()` must come before `.namespaces()` in the chain; their accumulated type flows into each namespace callback's ctx
- namespace keys in `.namespaces({})` autocomplete from schema and are validated
- the namespace builder parameter is conventionally named **`ns`**, keeping `e` free for the `entity` shorthand in destructured contexts
- **`.compile()`** is the explicit compile point — it renders the authoring AST to CEL and returns the plain `IdbPerms<Schema>` object (structurally assignable to `InstantRules<Schema>`); it makes the builder/output boundary explicit

## 4. The namespace pipeline

A namespace builder supports this timeline:

```TS
ns
  .stage(...)
  .bind(...)
  .allow(...)
  .fields(...)
```

### `.stage(...)`

`stage` creates **authoring-local** values. They are not emitted into the final object unless referenced by a bind, allow rule, field rule, or another emitted expression.

```ts
workspaces: ns => ns
  .stage(({ rp, e }) => ({
    inviteCode: rp('inviteCode'),
    inviteMatches: rp('inviteCode').eq(e.inviteCode),
  }))
  .bind(({ auth, er, s }) => ({
    isMember: er('memberships.user.id').contains(auth.id),
    hasInviteCode: s.inviteCode.neq(null).and(s.inviteMatches),
  }))
```

- staged values are available as `ctx.staged` and `ctx.s`
- staged values inherit from `.defaults(...)`
- duplicate stage names across inherited and local scopes are rejected
- explicit override is possible with `.overrideStage(...)`

### `.bind(...)`

`bind` creates **emitted** InstantDB bind aliases.

```ts
tasks: ns => ns
  .bind(({ auth, er }) => ({
    isSignedIn: auth.id.neq(null),
    isMember: er('workspace.memberships.user.id').contains(auth.id),
  }))
  .allow(({ b }) => ({
    view: b.isMember,
    create: b.isSignedIn.and(b.isMember),
  }))
```

- bind values are emitted under the namespace `bind` block
- bind values are available as `ctx.bindings` and `ctx.b`
- top-level `$default.bind` values are inherited by every namespace
- duplicate bind names across inherited and local scopes are rejected
- explicit override is possible with `.overrideBind(...)`

### `.overrideStage(...)` and `.overrideBind(...)`

Overrides should be rare and loud.

```TS
defaults: d => d
  .bind(({ auth }) => ({
    canWrite: auth.id.neq(null),
  })),

workspaces: ns => ns
  .overrideBind(({ auth, er }) => ({
    canWrite: er('memberships.user.id').contains(auth.id),
  }))
```

Rules:

- `.stage(...)` and `.bind(...)` reject duplicates
- `.overrideStage(...)` and `.overrideBind(...)` allow replacing inherited names
- overriding still rejects duplicate names within the same override block
- overrides are visible in later `ctx.s` / `ctx.b`

### `.allow(...)`

`allow` accepts booleans, expression nodes, action callbacks, or a callback that returns an allow object.

Compact object form:

```TS
.allow({
  view: true,
  create: false,
})
```

Common callback form:

```TS
.allow(({ b }) => ({
  view: b.isMember,
  create: b.isSignedIn.and(b.isMember),
  update: b.isMember,
  delete: b.isMember,
}))
```

Hybrid action-specific form:

```TS
.allow(({ b }) => ({
  view: b.isMember,
  create: ({ req }) => b.isSignedIn.and(
    req.modifiedFields.every(field => field.in(['title', 'createdAt'])),
  ),
  update: ({ e, eu }) => b.isMember.and(
    eu.title.neq(e.title),
  ),
  link: {
    assignee: ({ el, er }) => b.isMember.and(
      er('workspace.memberships.user.id').contains(el.id),
    ),
  },
  unlink: {
    workspace: false,
    assignee: b.isMember,
  },
}))
```

Design notes:

- object and common callback forms are concise for normal rules
- the outer `.allow(ctx => ({ ... }))` callback provides one shared common context for the whole allow block
- nested action callbacks enable context-specific typing and can close over the outer context
- prefer the common callback form unless a rule needs `entityUpdated`, `entityLinked`, or another action-only value
- simple link/unlink rules can be plain expressions; nested callbacks are only needed when the rule reads link-label-specific context
- `entityUpdated` / `eu` appears only in update contexts
- `entityLinked` / `el` and the linked ref helpers appear only in link/unlink contexts
- `request.modifiedFields` appears only in create/update contexts

Why link/unlink sometimes need a nested context:

- `entityLinked` is only meaningful for a specific link label
- its type changes by link label — `tasks.link.assignee` exposes a `$users` entity while `tasks.link.workspace` exposes a `workspaces` entity
- the outer allow context cannot give `el` one correct type for every link rule
- therefore link/unlink rules accept either a plain expression or a nested callback with the link-specific `el`, `elf`, and `elr` helpers

### `.fields(...)`

Field-level rules are a sibling builder step rather than hidden inside `allow`.

```ts
$users: ns => ns
  .bind(({ auth, e, er }) => ({
    isSelf: auth.id.eq(e.id),
    sharesWorkspace: er('memberships.workspace.memberships.user.id').contains(auth.id),
  }))
  .allow(({ b }) => ({
    view: b.isSelf.or(b.sharesWorkspace),
    create: true,
    update: b.isSelf,
  }))
  .fields(({ b }) => ({
    email: b.isSelf.or(b.sharesWorkspace),
  }))
```

Field keys autocomplete from the namespace's fields, excluding `id` if Instant keeps the current behavior.

## 5. Special builders

### `.attrs(...)`

`attrs` controls whether new namespaces and attributes can be created on the fly.

```ts
definePerms(schema)
  .attrs(attrs => attrs.allow({ create: false }))
  .compile()
```

- only `create` is supported
- no namespace context exists — no `entity`, no `entityRef`
- stage and bind can exist if useful, but the context is intentionally narrow

### `.defaults(...)`

`defaults` maps to the top-level `$default` namespace.

```ts
definePerms(schema)
  .defaults(d => d
    .bind(({ auth }) => ({
      isSignedIn: auth.id.neq(null),
    }))
    .allow({ $default: false }))
  .namespaces({
    tasks: ns => ns
      .allow(({ b }) => ({
        create: b.isSignedIn,
      })),
  })
  .compile()
```

- `$default.allow` compiles to Instant's top-level `$default.allow`
- `$default.bind` is inherited by every namespace
- staged defaults are authoring-only and inherited by namespace contexts
- namespace-specific fields are not known in the default context
- `entityField(string)` / `entityRef(string)` may be allowed as loose helpers, but must not claim namespace-specific autocomplete

## 6. The context object

Every callback receives a context object. Long names are self-documenting; short names are always available for high-density rules.

The context is **entity-rooted with current unmarked**: the current entity is *the* entity, so it carries no marker; only the *updated* and *linked* states do. Every `e*` shorthand is entity-family — the second letter says *which* entity (none = current, `u` = updated, `l` = linked), the suffix says *how you read it* (`f` = field by string key, `r` = ref traversal). CEL's `data`/`newData`/`linkedData` are what these compile to; they never appear in the authoring surface.

### Common context

| Long name | Short name | Meaning | Emits |
|---|---:|---|---|
| `staged` | `s` | authoring-local staged values | — |
| `bindings` | `b` | emitted bind aliases in scope | bare identifiers |
| `auth` | - | current authenticated user | `auth.<key>` |
| `authRef` | `ar` | linked attrs from `$users` | `auth.ref('$user...')` |
| `entity` | `e` | current entity fields by property access | `data.<field>` |
| `entityField` | `ef` | current entity field by string key | `data.<field>` |
| `entityRef` | `er` | linked attrs from the current entity | `data.ref('...')` |
| `ruleParams` | `rp` | rule params by key; keys autocomplete from the namespace's `ruleParams` declaration in `defineSchema` | `ruleParams.<key>` |
| `request` | `req` | request metadata: `req.time`, `req.ip`, `req.origin` | `request.*` |
| `rateLimit` | `rl` | rate limit buckets | `rateLimit.*` |
| `ops` | `f` | functional expression helpers | — |
| `raw` | - | explicit raw CEL escape hatch | as written |

`req.modifiedFields` is **not** in the common context — it is meaningful only while writing, so it appears on `req` in create and update callbacks (the backend populates it only there). `raw(...)` yields a boolean expression by default; pass a type param (`raw<string>(...)`) for a non-boolean terminal.

### Update context

Only available in update callbacks and action-specific update binds/stages.

| Long name | Short name | Meaning | Emits |
|---|---:|---|---|
| `entityUpdated` | `eu` | updated entity fields by property access | `newData.<field>` |
| `entityUpdatedField` | `euf` | updated entity field by string key | `newData.<field>` |

There is no `entityUpdatedRef`. Instant documents `newData.ref(...)` as unsupported.

### Link and unlink context

Only available in link/unlink callbacks and action-specific link/unlink binds/stages.

| Long name | Short name | Meaning |
|---|---:|---|
| `entityLinked` | `el` | fields of the linked entity |
| `entityLinkedField` | `elf` | linked entity field by string key |
| `entityLinkedRef` | `elr` | linked attrs from the linked entity |

## 7. Entity and ref API

The API avoids collisions between fields and helper methods.

### Direct field access

```ts
ctx.entity.title.eq('hello')
ctx.e.title.eq('hello')
ctx.entityUpdated.title.neq(ctx.entity.title)
ctx.eu.title.neq(ctx.e.title)
ctx.entityLinked.id.eq(ctx.auth.id)
ctx.el.id.eq(ctx.auth.id)
```

Direct access autocompletes from the relevant namespace's fields.

### String field access

```ts
ctx.entityField('title')
ctx.ef('title')
ctx.entityUpdatedField('title')
ctx.euf('title')
ctx.entityLinkedField('email')
ctx.elf('email')
```

Use this when:

- the field name is easier to pass as a string
- the field name collides with a JavaScript property concern
- the field name is dynamic enough that property access is awkward, but still a string literal known to TypeScript

### Linked ref access

```ts
ctx.entityRef('workspace.memberships.user.id')
ctx.er('workspace.memberships.user.id')
ctx.entityLinkedRef('profile.id')
ctx.elr('profile.id')
ctx.authRef('$user.roles.type')
ctx.ar('$user.roles.type')
```

Rules:

- ref path args must be string literals
- the terminal segment must be an attribute, not just a link label
- return type is always `ListExpr<T>`
- ref paths autocomplete across links up to a practical depth
- recommended depth cap: 4 hops
- JSON terminal attrs produce `ListExpr<JsonValue>`, not flattened lists

This avoids the field-named-`ref` collision:

```ts
ctx.entity.ref.eq('abc') // a field literally named "ref"
ctx.entityRef('owner.id') // CEL data.ref('owner.id')
```

## 8. Expression API

Expressions support both fluent and functional composition.

### Fluent methods

```ts
auth.id.neq(null)
e.title.eq('hello')
e.createdAt.lt(req.time)
b.isMember.and(b.isSignedIn)
b.isOwner.or(b.isAdmin)
```

Core methods: `.eq(value)` `.neq(value)` `.gt(value)` `.gte(value)` `.lt(value)` `.lte(value)` `.in(list)` `.and(expr)` `.or(expr)` `.not()`

String-like methods: `.startsWith(value)` `.endsWith(value)` `.includes(value)` `.matches(value)` (if CEL/runtime support is confirmed)

### List methods

`entityRef`, `authRef`, `entityLinkedRef`, and list-like attrs return list expressions.

```ts
er('memberships.user.id').contains(auth.id)
er('memberships.user.id').isEmpty()
er('memberships.user.id').isNonEmpty()
er('memberships.user.id').size().lte(2)
ar('$user.roles.type').contains('admin')
```

List methods:

- `.contains(value)` → emits `value in list`
- `.isEmpty()` → emits `list == []`
- `.isNonEmpty()` → emits `list != []`
- `.size()` → emits `size(list)`
- `.at(index)` → emits `list[index]`
- `.some(item => expr)` → emits CEL `.exists(...)`
- `.every(item => expr)` → emits CEL `.all(...)`

Example with a JSON-array terminal attribute:

```ts
er('ownedRole.types').some(types => types.contains('admin'))
```

This is intentionally different from:

```ts
er('ownedRole.types').contains('admin')
```

If the terminal `types` attribute is itself a JSON array, `data.ref('ownedRole.types')` returns a list of terminal JSON values, for example `[['admin', 'editor']]`. It does not flatten the inner array.

### Functional helpers

Functional composition lives under `ctx.ops` and shorthand `ctx.f`.

```TS
.allow(({ f, b, e, rp }) => ({
  view: f.or(
    b.isAdmin,
    f.and(
      b.isMember,
      e.inviteCode.eq(rp('inviteCode')),
    ),
  ),
}))
```

Recommended helpers: `f.and(...exprs)` `f.or(...exprs)` `f.not(expr)` `f.eq(a, b)` `f.neq(a, b)` `f.gt(a, b)` `f.gte(a, b)` `f.lt(a, b)` `f.lte(a, b)` `f.in(item, list)` `f.contains(list, item)` `f.size(value)` `f.list(...values)` `f.str(value)` `f.num(value)` `f.bool(value)` `f.null()`

Rationale:

- fluent is best for subject-first rules
- functional is best for nested or n-ary composition
- `f` keeps destructured contexts compact; `ops` gives the same surface a readable long name

### Raw escape hatch

Raw CEL should be explicit.

```TS
.allow(({ raw }) => ({
  view: raw("auth.email.endsWith('@company.com')"),
}))
```

- arbitrary strings are not accepted as ordinary expressions — `raw(...)` is the one explicit door, and it marks the unsafety at the call site
- raw renders verbatim and yields a boolean expression by default; pass a type param (`raw<string>(...)`) for a non-boolean terminal
- raw composes safely: it carries the lowest precedence, so any expression built around it is always parenthesized

### `.conforms()` — runtime-enum membership

A **runtime enum** ([dux-spec-root.md §2.6](./dux-spec-root.md#26-enum-fields)) declares its allowed values in the schema. `.conforms()` enforces that a field's value is one of them — reading the values from the schema so they are declared once, not retyped in the rule. It is the DRY bridge between the schema declaration and perms; the declaration never enforces on its own, so this is where membership becomes a rule.

```ts
tasks: ns => ns.allow({
  create: ({ b, eu }) => b.isMember.and(eu.priority.conforms()),
  update: ({ eu }) => eu.priority.conforms(),
  // legacy gating: only show rows that still satisfy a newer enum
  view: ({ e }) => e.priority.conforms(),
})
```

Contract:

- **It is sugar for membership against the schema's values** — `eu.priority.conforms()` renders the CEL `newData.priority in ['low', 'medium', 'high']` (`data.*` for the current entity, `linkedData.*` for a linked one). It is exactly `eu.priority.in([...])` with the list supplied by the schema; `.in(explicitList)` remains for an ad-hoc subset.
- **Exposed only on runtime-enum fields.** `.conforms()` exists on a field accessor only when that field is a runtime enum — there is nothing to conform to otherwise, so on any other field the method is absent (an error at the cursor, not a no-op).
- **Every entity field, every action.** Available on `e`/`ef`, `eu`/`euf`, `el`/`elf`, and `auth` (property access and string-key forms alike), in any rule — including `view`/`delete`, not just writes, so it can gate pre-existing rows against a newer enum.
- **Refs too.** `er`/`ar`/`elr` whose terminal segment is a runtime-enum field expose `.conforms()`; since a ref yields a list, it renders as a list conformance (`data.ref('assignee.role').all(item, item in [...])`). The user opts in per ref.
- **Needs the schema value.** Because it reads the declared values at compile time, `.conforms()` requires `definePerms(schema)` (the runtime form). The type layer exposes it on any runtime-enum accessor; under the type-only `definePerms()` there are no values to render, so `.compile()` throws `QERR_PERMS_CONFORMS` — pass the schema.

The result is the schema-as-source-of-truth payoff without coupling: the enum is declared once in `defineSchema`, and enforcement stays explicit, opt-in, and visible in the security layer.

## 9. Action-specific stage and bind

Common `.stage(...)` and `.bind(...)` callbacks receive only common context. That prevents `entityUpdated` and `entityLinked` from leaking into rules where Instant cannot evaluate them.

When aliasing action-specific logic is needed, use action-specific forms.

Action-specific staged values:

```ts
posts: ns => ns
  .stageFor('update', ({ e, eu }) => ({
    titleChanged: eu.title.neq(e.title),
  }))
  .allow(() => ({
    update: ({ s }) => s.titleChanged,
  }))
```

Action-specific binds:

```ts
posts: ns => ns
  .bind(({ auth, e }) => ({
    isOwner: auth.id.eq(e.ownerId),
  }))
  .bindFor('update', ({ auth, eu }) => ({
    isStillOwner: auth.id.eq(eu.ownerId),
  }))
  .allow(() => ({
    update: ({ b }) => b.isOwner.and(b.isStillOwner),
  }))
```

For link/unlink:

```ts
memberships: ns => ns
  .bindFor('link', 'user', ({ auth, el }) => ({
    linksSelf: el.id.eq(auth.id),
  }))
  .allow(() => ({
    link: {
      user: ({ b }) => b.linksSelf,
    },
  }))
```

Rules:

- action-specific stage names are authoring-only and only exposed in compatible action callbacks
- action-specific bind names still compile into the normal Instant `bind` block, and are only exposed in compatible action callbacks
- nested action contexts include compatible common stage/bind values plus the action-specific ones
- duplicate names across common and action-specific binds are rejected
- `.overrideBind(...)` may explicitly replace inherited names

An action-specific bind is emitted into the namespace's ordinary `bind` block — the backend evaluates each bind only in the rules that reference it, so an `update`-scoped bind that reads `newData` is computed only for updates (Instant's own docs use `newData` inside `bind` for exactly this). The action scope is therefore an *authoring-visibility* boundary: the type carries each `stageFor`/`bindFor` name only into its matching action callback, so it can't be referenced — and so can't compile to invalid CEL — anywhere the value wouldn't exist.

## 10. Output

The builder emits `IdbPerms<Schema>` — structurally assignable to the official `InstantRules<Schema>`.

Authoring:

```TS
.allow(({ b }) => ({
  view: true,
  create: false,
  update: b.isMember,
}))
```

Output:

```TS
{
  allow: {
    view: 'true',
    create: 'false',
    update: 'isMember',
  },
}
```

Design notes:

- boolean authoring values are accepted for ergonomics
- output uses CEL strings for maximum compatibility with current tooling
- expression rendering uses deterministic parentheses
- generated CEL should be easy to inspect in diffs

## 11. Rate limits

The official rules shape supports `$rateLimits`. The authoring API exposes both configuration and usage.

Configuration:

```ts
definePerms(schema)
  .rateLimits({
    createTask: {
      limits: [{ capacity: 10, refill: { period: '1 minute' } }],
    },
  })
  .namespaces({
    tasks: ns => ns
      .allow(({ rl, auth }) => ({
        create: rl.createTask.limit(auth.id),
      })),
  })
  .compile()
```

Usage renders to CEL:

```cel
rateLimit.createTask.limit(auth.id)
```

## 12. Validation

### Namespace validation

- `.namespaces({})` keys autocomplete from schema namespaces plus special keys (`$users`, `$default`, etc.)
- unknown namespace keys are TypeScript errors
- with `definePerms(schema)`, unknown namespaces also throw runtime errors
- each namespace's `rp`/`ruleParams` context is typed against the `ruleParams` declaration for that namespace in `defineSchema` — unknown param keys are TypeScript errors
- **rooms are not targetable** — the keys are `keyof schema.entities`, which excludes the `rooms` block; perms govern persisted entities, and the rules engine never runs on ephemeral presence/topics channels. This matches official idb, whose `InstantRules` is keyed the same way ([dux-spec-root.md §2.7](./dux-spec-root.md#27-rooms)).

### Field validation

- `ctx.entity.<field>` autocompletes fields for the current namespace
- `ctx.entityField('<field>')` validates string literals against the current namespace
- `ctx.entityUpdated` is only available in update context
- `ctx.entityLinked` is only available in link/unlink context

### Ref path validation

- `entityRef` starts from the current namespace
- `entityLinkedRef` starts from the linked namespace
- `authRef` starts from `$users`; callers pass a `$user.`-prefixed path, matching Instant's `auth.ref('$user...')` requirement
- path traversal follows schema link labels
- the final segment must be an attribute
- return type is `ListExpr<TerminalAttrValue>`

### Context validation

Invalid usage fails at the cursor (principle 3):

```ts
allow({
  view: ({ eu }) => eu.title.eq('x'),
  //      ^^ entityUpdated is not available in view
})

allow({
  update: ({ el }) => el.id.eq('x'),
  //        ^^ entityLinked is not available in update
})
```

### Bind validation

- duplicate bind names in the same scope fail
- duplicate bind names across inherited defaults and namespace scope fail
- duplicate stage names follow the same rule
- `.overrideBind` and `.overrideStage` are the explicit escape hatches
- cyclic bind dependencies are detected if practical, or left to Instant validation with a clear error

## 13. Full example and implementation notes

### Full example

The canonical app shape: users, workspaces, memberships, and tasks.

```ts
import { definePerms } from '@mszr/idb-dux/perms'
import { schema } from './instant.schema'

export default definePerms(schema)
  .attrs(a => a.allow({ create: false }))
  .defaults(d => d
    .bind(({ auth }) => ({
      isSignedIn: auth.id.neq(null),
    }))
    .allow({ $default: false }))
  .namespaces({
    $users: ns => ns
      .bind(({ auth, e, er }) => ({
        isSelf: auth.id.eq(e.id),
        sharesWorkspace: er('memberships.workspace.memberships.user.id').contains(auth.id),
      }))
      .allow(({ b }) => ({
        view: b.isSelf.or(b.sharesWorkspace),
        create: true,
        update: b.isSelf,
      }))
      .fields(({ b }) => ({
        email: b.isSelf.or(b.sharesWorkspace),
      })),
    workspaces: ns => ns
      .stage(({ rp, e }) => ({
        inviteCode: rp('inviteCode'),
        inviteMatches: rp('inviteCode').eq(e.inviteCode),
      }))
      .bind(({ auth, er, s }) => ({
        isMember: er('memberships.user.id').contains(auth.id),
        hasInviteCode: s.inviteCode.neq(null).and(s.inviteMatches),
      }))
      .allow(({ b }) => ({
        view: b.isMember.or(b.hasInviteCode),
        create: b.isSignedIn,
        update: b.isMember,
        delete: b.isMember,
      })),
    memberships: ns => ns
      .bind(({ auth, er, rp }) => ({
        isMember: er('workspace.memberships.user.id').contains(auth.id),
        isSelf: er('user.id').contains(auth.id),
        hasInviteCode: rp('inviteCode').neq(null).and(er('workspace.inviteCode').contains(rp('inviteCode'))),
      }))
      .allow(({ b }) => ({
        view: b.isMember,
        create: b.isSignedIn,
        update: b.isSelf,
        delete: b.isSelf,
        link: {
          user: ({ auth, el }) => el.id.eq(auth.id),
          workspace: ({ rp, el }) => b.isMember.or(
            rp('inviteCode').neq(null).and(el.inviteCode.eq(rp('inviteCode'))),
          ),
        },
        unlink: {
          user: b.isSelf,
          workspace: b.isSelf,
        },
      })),
    tasks: ns => ns
      .bind(({ auth, er }) => ({
        isMember: er('workspace.memberships.user.id').contains(auth.id),
      }))
      .allow(({ b }) => ({
        view: b.isMember,
        create: b.isSignedIn.and(b.isMember),
        update: b.isMember,
        delete: b.isMember,
        link: {
          workspace: b.isMember,
          assignee: ({ el, er }) => b.isMember.and(
            er('workspace.memberships.user.id').contains(el.id),
          ),
        },
        unlink: {
          workspace: false,
          assignee: b.isMember,
        },
      })),
  })
  .compile()
```

Expected output shape:

```TS
{
  attrs: {
    allow: {
      create: 'false',
    },
  },
  $default: {
    bind: {
      isSignedIn: 'auth.id != null',
    },
    allow: {
      $default: 'false',
    },
  },
  // ...ordinary Instant namespace rules with CEL strings...
}
```

### Expression nodes

Each helper returns a small immutable expression node:

```ts
interface Expr<T> {
  kind: string
  type: T
  render: () => string
}
```

In practice, `type` is phantom type information. Runtime nodes need enough metadata to render CEL and validate obvious local mistakes.

### Renderer

Renderer responsibilities:

- escape string literals
- render booleans and null
- render property access (`entity.title` → `data.title`, `entityUpdated.title` → `newData.title`)
- render function calls
- render binary operators with deterministic parentheses
- render CEL list macros for `.some` and `.every`
- render bind alias references as bare identifiers

### Type depth

Ref path autocomplete should be deep enough to be useful and shallow enough not to punish TypeScript:

- direct fields: all fields
- ref paths: up to 4 link hops plus terminal attribute
- escape hatch: `raw(...)` for paths beyond TS limits

### Development validation

With `definePerms(schema)`, dev builds validate:

- namespace exists
- field exists
- ref path exists and its terminal is an attribute
- `entityLinkedRef` paths start from the linked namespace
- duplicate stage/bind keys
- action-specific context misuse if runtime metadata is present

### Compatibility

The generated object is `IdbPerms<AppSchema>`, structurally assignable to `InstantRules<AppSchema>`. No backend changes are required. The compiled object is also exactly what the push tooling consumes: `instant-cli push perms` *evaluates* `instant.perms.ts` (so a default export of `definePerms(...).compile()` pushes as-is), and the official platform SDK's `pushPerms` accepts it by construction. Both guarantees are locked by the compat-target tests ([dux-spec-workspace.md §4.6](./dux-spec-workspace.md#46-compatibility-target-tests)).

---

## 14. Phased implementation roadmap

### Phase P1 — AST, renderer, compile pipeline (global phase 8)

Done when: a minimal `definePerms(schema).namespaces({}).compile()` emits a valid rules object.

- [x] expression AST node design (immutable, phantom-typed, renderable)
- [x] CEL renderer: literals, property access, binary ops with deterministic parentheses, calls
- [x] `definePerms()` / `definePerms(schema)` / `definePerms<S>()` entrypoints
- [x] `.namespaces({}).compile()` skeleton → `IdbPerms<Schema>`

### Phase P2 — common context + core builders (global phase 8)

Done when: the full example's non-action-specific rules compile and validate.

- [x] common context: `entity`/`e`, `entityField`/`ef`, `entityRef`/`er`, `authRef`/`ar`, `auth`, `ruleParams`/`rp`, `request`/`req`
- [x] `.stage` / `.bind` / `.allow` / `.fields`
- [x] `.defaults` inheritance (bind + staged) and duplicate rejection
- [x] `.overrideStage` / `.overrideBind`
- [x] `.dx.test.ts`: namespace keys, field access, ref-path completions, ruleParams completions
- [x] `.test-d.ts`: ctx typing per namespace

### Phase P3 — expression breadth (global phase 8)

- [x] list methods: `.contains`, `.isEmpty`, `.isNonEmpty`, `.size`, `.at`, `.some`, `.every`
- [x] `ctx.f` / `ctx.ops` functional helpers
- [x] `raw(...)` escape hatch
- [x] renderer: CEL list macros (`.exists`, `.all`)

### Phase P4 — action-specific contexts (global phase 8)

- [x] action callback forms: `eu`/`euf` in update; `el`/`elf`/`elr` in link/unlink with per-label typing
- [x] `request.modifiedFields` in create/update
- [x] context misuse fails at the cursor (dx-locked)
- [x] `stageFor` / `bindFor` (whole-entity and per-label link/unlink; names scoped to the matching action callback)

### Phase P5 — special builders, diagnostics, compat (global phase 8)

- [x] `.attrs` (create-only, narrow context)
- [x] `.rateLimits` config + `rl` usage rendering
- [x] runtime schema validation diagnostics (`definePerms(schema)` dev assertions: namespace, field, ref path, ruleParam, duplicate name)
- [x] compat-target tests: `InstantRules` assignability + push fixture
- [x] cyclic bind detection — delegated to Instant: the backend topologically sorts and validates the emitted `bind` block (`server/.../rule.clj`)

### Phase P6 — runtime-enum conformance (global phase 8)

- [x] `.conforms()` on entity-field accessors (`e`/`ef`, `eu`/`euf`, `el`/`elf`, `auth`), exposed only when the field is a runtime enum
- [x] `.conforms()` on refs (`er`/`ar`/`elr`) whose terminal is a runtime enum → list-conformance (`.all(...)`) rendering
- [x] reads declared values from `definePerms(schema)`; renders `… in [...]`; throws under the type-only entrypoint (no values to render)
- [x] `.dx.test.ts`: `.conforms()` present only on runtime enums; absent on plain and type-level-enum fields
- [x] `.test.ts`: rendered CEL matches `in [...]` (scalar) / `.all(item, item in [...])` (ref)
