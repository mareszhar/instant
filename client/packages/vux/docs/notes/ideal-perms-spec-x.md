updated: 2026-06-11
status: converged spec — aligned with `dux-a-blueprint-with-foresight.md` (the authority)

# The dux Perms Spec

> **Historical note.** Formerly "Ideal Permissions Spec X" for `@mszr/idb-vux/perms`. Converged to the dux blueprint: `definePerms` (no `X`), `.compile()` instead of `.toRules()`, output type `IdbPerms` (structurally assignable to `InstantRules`), and the entity-rooted context — CEL's `data`/`newData`/`linkedData` are compile targets only, never authoring surface. The filename keeps `ideal-perms-spec-x.md` for link stability until the docs plan (blueprint §14) supersedes it with `dux-spec-perms.md`.

This is the concrete spec for the typed permissions authoring layer of `@mszr/idb-dux`.

The goal is not to replace InstantDB permissions. The goal is a nicer TypeScript authoring API that compiles to the same plain rules object Instant already accepts.

## Goals

1. Compile to ordinary InstantDB permission rules.
2. Keep the generated output inspectable: CEL strings in the final object.
3. Make common perms feel like TypeScript, not string assembly.
4. Provide schema-aware IntelliSense for namespaces, fields, link labels, and ref paths.
5. Validate common CEL footguns at author time.
6. Support escape hatches without making unsafety the default path.
7. One mental model: the same `namespace`/`entity`/`field`/`ref` vocabulary as schema and queries — users never juggle a CEL dialect.

## Package Surface

```ts
import { definePerms } from '@mszr/idb-dux/perms'
```

The subpath is authoring-only. It is never bundled into client runtime code unless the user imports it from client modules by choice.

## Entrypoints

### Type-Only (via registration)

Use this when the schema value is not available or only TypeScript validation is wanted. With the schema registered (blueprint §11.3), no generic is needed:

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

Properties:

- full TypeScript IntelliSense and validation
- no runtime schema validation

### Runtime Schema (preferred)

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

Properties:

- all type-only benefits
- runtime validation for namespace names, field names, link labels, and ref paths
- better diagnostics and dev-time assertions

## Authoring Shape

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

## Core Namespace Pipeline

A namespace builder supports this timeline:

```TS
ns
  .stage(...)
  .bind(...)
  .allow(...)
  .fields(...)
```

### `.stage(...)`

`stage` creates authoring-local values. They are not emitted into the final object unless referenced by a bind, allow rule, field rule, or another emitted expression.

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

Design notes:

- staged values are available as `ctx.staged` and `ctx.s`
- staged values inherit from `.defaults(...)`
- duplicate stage names across inherited and local scopes are rejected
- explicit override is possible with `.overrideStage(...)`

### `.bind(...)`

`bind` creates emitted InstantDB bind aliases.

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

Design notes:

- bind values are emitted under the namespace `bind` block
- bind values are available as `ctx.bindings` and `ctx.b`
- top-level `$default.bind` values are inherited by every namespace
- duplicate bind names across inherited and local scopes are rejected
- explicit override is possible with `.overrideBind(...)`

### `.overrideStage(...)` And `.overrideBind(...)`

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
    req.modifiedFields.all(field => field.in(['title', 'createdAt'])),
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

## Special Builders

### `.attrs(...)`

`attrs` is special. It controls whether new namespaces and attributes can be created on the fly.

```ts
definePerms(schema)
  .attrs(attrs => attrs.allow({ create: false }))
  .compile()
```

Design notes:

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

Design notes:

- `$default.allow` compiles to Instant's top-level `$default.allow`
- `$default.bind` is inherited by every namespace
- staged defaults are authoring-only and inherited by namespace contexts
- namespace-specific fields are not known in the default context
- `entityField(string)` / `entityRef(string)` may be allowed as loose helpers, but must not claim namespace-specific autocomplete

## Context Object

Every callback receives a context object. Long names are self-documenting; short names are always available for high-density rules.

The context is **entity-rooted with current unmarked**: the current entity is *the* entity, so it carries no marker; only the *updated* and *linked* states do. Every `e*` shorthand is entity-family — the second letter says *which* entity (none = current, `u` = updated, `l` = linked), the suffix says *how you read it* (`f` = field by string key, `r` = ref traversal). CEL's `data`/`newData`/`linkedData` are what these compile to; they never appear in the authoring surface.

### Common Context

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
| `request` | `req` | request metadata | `request.*` |
| `rateLimit` | `rl` | rate limit buckets | `rateLimit.*` |
| `ops` | `f` | functional expression helpers | — |
| `raw` | - | explicit raw CEL escape hatch | as written |

### Update Context

Only available in update callbacks and action-specific update binds/stages.

| Long name | Short name | Meaning | Emits |
|---|---:|---|---|
| `entityUpdated` | `eu` | updated entity fields by property access | `newData.<field>` |
| `entityUpdatedField` | `euf` | updated entity field by string key | `newData.<field>` |

There is no `entityUpdatedRef`. Instant documents `newData.ref(...)` as unsupported.

### Link And Unlink Context

Only available in link/unlink callbacks and action-specific link/unlink binds/stages.

| Long name | Short name | Meaning |
|---|---:|---|
| `entityLinked` | `el` | fields of the linked entity |
| `entityLinkedField` | `elf` | linked entity field by string key |
| `entityLinkedRef` | `elr` | linked attrs from the linked entity |

## Entity And Ref API

The API avoids collisions between fields and helper methods.

### Direct Field Access

```ts
ctx.entity.title.eq('hello')
ctx.e.title.eq('hello')
ctx.entityUpdated.title.neq(ctx.entity.title)
ctx.eu.title.neq(ctx.e.title)
ctx.entityLinked.id.eq(ctx.auth.id)
ctx.el.id.eq(ctx.auth.id)
```

Direct access autocompletes from the relevant namespace's fields.

### String Field Access

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

### Linked Ref Access

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

## Expression API

Expressions support both fluent and functional composition.

### Fluent Methods

```ts
auth.id.neq(null)
e.title.eq('hello')
e.createdAt.lt(req.time)
b.isMember.and(b.isSignedIn)
b.isOwner.or(b.isAdmin)
```

Core methods: `.eq(value)` `.neq(value)` `.gt(value)` `.gte(value)` `.lt(value)` `.lte(value)` `.in(list)` `.and(expr)` `.or(expr)` `.not()`

String-like methods: `.startsWith(value)` `.endsWith(value)` `.includes(value)` `.matches(value)` (if CEL/runtime support is confirmed)

### List Methods

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

### Functional Helpers

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

### Raw Escape Hatch

Raw CEL should be explicit.

```TS
.allow(({ raw }) => ({
  view: raw("auth.email.endsWith('@company.com')"),
}))
```

Design notes:

- arbitrary strings are not accepted as ordinary expressions
- `raw(...)` marks the unsafety at the call site
- a migration/compat mode may allow direct strings, but it is opt-in
- raw expressions are still parsed if a CEL parser is available in dev/test

## Action-Specific Stage And Bind

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

Implementation can defer `stageFor` / `bindFor` if phase 1 only targets common rules (a settled intention — see `ideal-vux.md` §11), but the API leaves room for it because Instant's own docs use `newData` inside `bind`.

## Output

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

## Rate Limits

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

## Validation

### Namespace Validation

- `.namespaces({})` keys autocomplete from schema namespaces plus special keys (`$users`, `$default`, etc.)
- unknown namespace keys are TypeScript errors
- with `definePerms(schema)`, unknown namespaces also throw runtime errors
- each namespace's `rp`/`ruleParams` context is typed against the `ruleParams` declaration for that namespace in `defineSchema` — unknown param keys are TypeScript errors

### Field Validation

- `ctx.entity.<field>` autocompletes fields for the current namespace
- `ctx.entityField('<field>')` validates string literals against the current namespace
- `ctx.entityUpdated` is only available in update context
- `ctx.entityLinked` is only available in link/unlink context

### Ref Path Validation

- `entityRef` starts from the current namespace
- `entityLinkedRef` starts from the linked namespace
- `authRef` starts from `$users`; callers pass a `$user.`-prefixed path, matching Instant's `auth.ref('$user...')` requirement
- path traversal follows schema link labels
- the final segment must be an attribute
- return type is `ListExpr<TerminalAttrValue>`

### Context Validation

Invalid usage fails at the cursor:

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

### Bind Validation

- duplicate bind names in the same scope fail
- duplicate bind names across inherited defaults and namespace scope fail
- duplicate stage names follow the same rule
- `.overrideBind` and `.overrideStage` are the explicit escape hatches
- cyclic bind dependencies are detected if practical, or left to Instant validation with a clear error

## Full Example

This example mirrors the demo shape: users, workspaces, memberships, and tasks.

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

## Implementation Notes

### Expression Nodes

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

### Type Depth

Ref path autocomplete should be deep enough to be useful and shallow enough not to punish TypeScript:

- direct fields: all fields
- ref paths: up to 4 link hops plus terminal attribute
- escape hatch: `raw(...)` for paths beyond TS limits

### Development Validation

With `definePerms(schema)`, dev builds validate:

- namespace exists
- field exists
- ref path exists and its terminal is an attribute
- `entityLinkedRef` paths start from the linked namespace
- duplicate stage/bind keys
- action-specific context misuse if runtime metadata is present

### Compatibility

The generated object is `IdbPerms<AppSchema>`, structurally assignable to:

```ts
InstantRules<AppSchema>
```

No backend changes are required. The compiled object is also exactly what the push tooling consumes: `instant-cli push perms` *evaluates* `instant.perms.ts` (so a default export of `definePerms(...).compile()` pushes as-is), and the official platform SDK's `pushPerms` accepts it by construction. Both guarantees are locked by the compat-target tests (blueprint §1.5, §8.6).

## Proposed Build Order

1. Expression AST and CEL renderer.
2. `definePerms(schema).namespaces({}).compile()`.
3. Common context: direct fields, `entityField`, `entityRef`, `authRef`, `ruleParams`.
4. `.stage`, `.bind`, `.allow`, `.fields`.
5. Default inheritance and duplicate checking.
6. Action callback form for `entityUpdated` and `entityLinked`.
7. List helpers: `.contains`, `.isEmpty`, `.isNonEmpty`, `.size`, `.some`, `.every`.
8. `ctx.f` / `ctx.ops` functional helpers.
9. `.attrs`, `.defaults`, `$rateLimits`.
10. Runtime schema validation diagnostics.
11. Optional compat mode for direct raw strings.
