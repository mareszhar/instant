updated: 2026-06-05
status: proposed

# Ideal Permissions Spec X

This is a concrete proposal for a typed permissions authoring layer for
`@mszr/idb-vux`.

The goal is not to replace InstantDB permissions. The goal is to write a nicer
TypeScript authoring API that compiles to the same plain `InstantRules` object
Instant already accepts.

## Goals

1. Compile to ordinary InstantDB permission rules.
2. Keep the generated output inspectable: CEL strings in the final rules object.
3. Make common permission rules feel like TypeScript, not string assembly.
4. Provide schema-aware IntelliSense for namespaces, fields, link labels, and ref
   paths.
5. Validate common CEL footguns at author time.
6. Support escape hatches without making unsafety the default path.

## Package Surface

Recommended subpath:

```ts
import { definePerms } from '@mszr/idb-vux/perms'
```

The subpath should be authoring-only. It does not need to be bundled into client
runtime code unless the user imports it from client modules by choice.

## Entrypoints

The API should support both a type-only route and a runtime-schema route.

### Type-Only Schema

Use this when the schema value is not available or when the user only wants
TypeScript validation.

```ts
import type { AppSchema } from './instant.schema'
import { definePerms } from '@mszr/idb-vux/perms'

const p = definePerms<AppSchema>()

const rules = p.rules({
  tasks: e => e.allow({
    view: true,
  }),
})

export default rules
```

Properties:

- full TypeScript IntelliSense and validation
- no runtime schema validation
- can still support `.rules({ ... })`
- can support `.ns.tasks(...)` through a proxy, but no runtime validation

### Runtime Schema

Use this as the preferred route in app code.

```ts
import { definePerms } from '@mszr/idb-vux/perms'
import schema from './instant.schema'

const rules = definePerms(schema).rules({
  tasks: e => e.allow({
    view: true,
  }),
})

export default rules
```

Properties:

- all type-only benefits
- runtime validation for namespace names, field names, link labels, and ref paths
- enables better diagnostics and potential dev-time assertions
- works with both `.rules({ ... })` and `.ns.<namespace>(...)`

## Two Authoring Shapes

Both authoring shapes should produce the same final output.

### Object Shape: `.rules({ ... })`

This should be the first implementation target. It is closest to the final
Instant rules object and returns plain rules immediately.

```ts
const rules = definePerms(schema).rules({
  workspaces: e => e
    .stage(({ rp }) => ({
      inviteCode: rp('inviteCode'),
    }))
    .bind(({ auth, dr, s }) => ({
      isSignedIn: auth.id.neq(null),
      isMember: dr('memberships.user.id').contains(auth.id),
      hasInviteCode: s.inviteCode.neq(null),
    }))
    .allow(({ b }) => ({
      view: b.isMember.or(b.hasInviteCode),
      create: b.isSignedIn,
      update: b.isMember,
      delete: b.isMember,
    })),
})
```

Why this shape:

- no finalizer needed
- easy to compare mentally with the generated rules
- top-level namespace keys are visible in one object
- entity context can be inferred from the object key

### Chain Shape: `.ns.<namespace>(...).toRules()`

This should be added as sugar after `.rules({ ... })`.

```ts
const rules = definePerms(schema)
  .attrs(a => a.allow({ create: false }))
  .defaults(d => d
    .bind(({ auth }) => ({
      isSignedIn: auth.id.neq(null),
    }))
    .allow({ $default: false }))
  .ns
  .workspaces(e => e
    .bind(({ auth, dr }) => ({
      isMember: dr('memberships.user.id').contains(auth.id),
    }))
    .allow(({ b }) => ({
      view: b.isMember,
      create: b.isSignedIn,
      update: b.isMember,
    })))
  .ns
  .tasks(e => e
    .bind(({ auth, dr }) => ({
      isMember: dr('workspace.memberships.user.id').contains(auth.id),
    }))
    .allow(({ b }) => ({
      view: b.isMember,
      create: b.isSignedIn.and(b.isMember),
      update: b.isMember,
      delete: b.isMember,
    })))
  .toRules()
```

Why this shape:

- lower indentation for long permission files
- feels like a staged builder timeline
- inherited defaults are visually declared before namespaces

Why `.toRules()` exists:

- it is the explicit compile point
- it returns the plain `InstantRules` object
- it avoids pretending the builder object itself is the final data structure

## Core Entity Pipeline

An entity builder should support this timeline:

```TS
e
  .stage(...)
  .bind(...)
  .allow(...)
  .fields(...)
```

### `.stage(...)`

`stage` creates authoring-local values. They are not emitted into the final
rules object unless referenced by a bind, allow rule, field rule, or another
emitted expression.

```ts
workspaces: e => e
  .stage(({ rp, d }) => ({
    inviteCode: rp('inviteCode'),
    inviteMatches: rp('inviteCode').eq(d.inviteCode),
  }))
  .bind(({ auth, dr, s }) => ({
    isMember: dr('memberships.user.id').contains(auth.id),
    hasInviteCode: s.inviteCode.neq(null).and(s.inviteMatches),
  }))
```

Design notes:

- staged values are available as `ctx.staged` and `ctx.s`
- staged values inherit from `.defaults(...)`
- duplicate stage names across inherited and local scopes should be rejected
- explicit override is possible with `.overrideStage(...)`

### `.bind(...)`

`bind` creates emitted InstantDB bind aliases.

```ts
tasks: e => e
  .bind(({ auth, dr }) => ({
    isSignedIn: auth.id.neq(null),
    isMember: dr('workspace.memberships.user.id').contains(auth.id),
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
- duplicate bind names across inherited and local scopes should be rejected
- explicit override is possible with `.overrideBind(...)`

### `.overrideStage(...)` And `.overrideBind(...)`

Overrides should be rare and loud.

```TS
defaults: (d) => d
  .bind(({ auth }) => ({
    canWrite: auth.id.neq(null),
  })),

workspaces: (e) => e
  .overrideBind(({ auth, dr }) => ({
    canWrite: dr('memberships.user.id').contains(auth.id),
  }))
```

Rules:

- `.stage(...)` and `.bind(...)` reject duplicates
- `.overrideStage(...)` and `.overrideBind(...)` allow replacing inherited names
- overriding should still reject duplicate names within the same override block
- overrides should be visible in later `ctx.s` / `ctx.b`

### `.allow(...)`

`allow` accepts booleans, expression nodes, action callbacks, or a callback that
returns an allow object.

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
    req.modifiedFields.all((field) => field.in(['title', 'createdAt'])),
  ),
  update: ({ d, nd }) => b.isMember.and(
    nd.title.neq(d.title),
  ),
  link: {
    assignee: ({ ld, dr }) => b.isMember.and(
      dr('workspace.memberships.user.id').contains(ld.id),
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
- the outer `.allow((ctx) => ({ ... }))` callback provides one shared common
  context for the whole allow block
- nested action callbacks enable context-specific typing
- nested action callbacks can close over values from the outer common context
- prefer the common callback form unless a rule needs `newData`, `linkedData`,
  or another action-only value
- simple link/unlink rules can be plain expressions; nested callbacks are only
  needed when that rule reads link-label-specific context
- `newData` / `nd` appears only in update contexts
- `linkedData` / `ld` and linked ref helpers appear only in link/unlink contexts
- `request.modifiedFields` appears only in create/update contexts

Why link/unlink sometimes need a nested context:

- `linkedData` is only meaningful for a specific link label
- its type changes by link label, for example `tasks.link.assignee` may expose a
  `$users` row while `tasks.link.workspace` exposes a `workspaces` row
- the outer allow context cannot give `ld` one correct type for every link rule
- therefore link/unlink rules accept either a plain expression or a nested
  callback with the link-specific `ld`, `ldf`, and `ldr` helpers

### `.fields(...)`

Field-level rules should be a sibling builder step rather than hidden inside
`allow`.

```ts
$users: e => e
  .bind(({ auth, d, dr }) => ({
    isSelf: auth.id.eq(d.id),
    sharesWorkspace: dr('memberships.workspace.memberships.user.id').contains(auth.id),
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

Field keys should autocomplete from entity attrs, excluding `id` if Instant keeps
the current `InstantRules` behavior.

## Special Builders

### `.attrs(...)`

`attrs` is special. It controls whether new namespaces and attrs can be created
on the fly.

```ts
const rules = definePerms(schema)
  .attrs(attrs => attrs.allow({ create: false }))
  .toRules()
```

Design notes:

- only `create` is supported
- no schema entity context exists
- no `dataRef` exists
- stage and bind can exist if useful, but the context is intentionally narrow

### `.defaults(...)`

`defaults` maps to the top-level `$default` namespace.

```ts
const rules = definePerms(schema)
  .defaults(d => d
    .stage(({ auth }) => ({
      signedIn: auth.id.neq(null),
    }))
    .bind(({ s }) => ({
      isSignedIn: s.signedIn,
    }))
    .allow({ $default: false }))
  .ns
  .tasks(e => e.allow(({ b }) => ({
    create: b.isSignedIn,
  })))
  .toRules()
```

Design notes:

- `$default.allow` compiles to Instant's top-level `$default.allow`
- `$default.bind` is inherited by every entity namespace
- staged defaults are authoring-only and inherited by entity contexts
- schema-specific entity attrs are not known in default context
- `dataField(string)` / `dataRef(string)` may be allowed as loose helpers, but
  should not claim entity-specific autocomplete

## Context Object

Every callback receives a context object. The long names are self-documenting.
The short names are always available for high-density permission rules.

### Common Context

| Long name | Short name | Meaning |
|---|---:|---|
| `staged` | `s` | authoring-local staged values |
| `bindings` | `b` | emitted bind aliases available in this scope |
| `auth` | - | current authenticated user object |
| `authRef` | `ar` | linked attrs from `$users`, emits `auth.ref(...)` |
| `data` | `d` | current entity attrs by property access |
| `dataField` | `df` | current entity attr by string key |
| `dataRef` | `dr` | linked attrs from current entity, emits `data.ref(...)` |
| `ruleParam` | `rp` | rule params by key, emits `ruleParams.<key>` |
| `request` | `req` | request metadata |
| `rateLimit` | `rl` | rate limit buckets |
| `ops` | `f` | functional expression helpers |
| `raw` | - | explicit raw CEL escape hatch |

### Update Context

Only available in update callbacks and action-specific update binds/stages.

| Long name | Short name | Meaning |
|---|---:|---|
| `newData` | `nd` | updated entity attrs by property access |
| `newDataField` | `ndf` | updated entity attr by string key |

There is no `newDataRef`. Instant documents `newData.ref(...)` as unsupported.

### Link And Unlink Context

Only available in link/unlink callbacks and action-specific link/unlink
binds/stages.

| Long name | Short name | Meaning |
|---|---:|---|
| `linkedData` | `ld` | attrs from the linked entity |
| `linkedDataField` | `ldf` | linked entity attr by string key |
| `linkedDataRef` | `ldr` | linked attrs from the linked entity |

## Data And Ref API

The API should avoid collisions between attrs and helper methods.

### Direct Attr Access

```ts
ctx.data.title.eq('hello')
ctx.d.title.eq('hello')
ctx.newData.title.neq(ctx.data.title)
ctx.nd.title.neq(ctx.d.title)
ctx.linkedData.id.eq(ctx.auth.id)
ctx.ld.id.eq(ctx.auth.id)
```

Direct attr access should autocomplete from the relevant entity.

### String Attr Access

```ts
ctx.dataField('title')
ctx.df('title')
ctx.newDataField('title')
ctx.ndf('title')
ctx.linkedDataField('email')
ctx.ldf('email')
```

Use this when:

- the attr name is easier to pass as a string
- the attr name collides with a JavaScript property concern
- the attr name is dynamic enough that property access is awkward, but still a
  string literal known to TypeScript

### Linked Ref Access

```ts
ctx.dataRef('workspace.memberships.user.id')
ctx.dr('workspace.memberships.user.id')
ctx.linkedDataRef('profile.id')
ctx.ldr('profile.id')
ctx.authRef('$user.roles.type')
ctx.ar('$user.roles.type')
```

Rules:

- ref path args must be string literals
- terminal segment must be an attr, not just a link label
- return type is always `ListExpr<T>`
- ref paths should autocomplete across links up to a practical depth
- recommended depth cap: 4 hops
- JSON terminal attrs produce `ListExpr<JsonValue>`, not flattened lists

This avoids the `data.ref` attr collision:

```ts
ctx.data.ref.eq('abc') // attr named "ref"
ctx.dataRef('owner.id') // CEL data.ref('owner.id')
```

## Expression API

Expressions should support both fluent and functional composition.

### Fluent Methods

Methods on expression nodes:

```ts
auth.id.neq(null)
d.title.eq('hello')
d.createdAt.lt(req.time)
b.isMember.and(b.isSignedIn)
b.isOwner.or(b.isAdmin)
```

Core methods:

- `.eq(value)`
- `.neq(value)`
- `.gt(value)`
- `.gte(value)`
- `.lt(value)`
- `.lte(value)`
- `.in(list)`
- `.and(expr)`
- `.or(expr)`
- `.not()`

String-like methods:

- `.startsWith(value)`
- `.endsWith(value)`
- `.includes(value)`
- `.matches(value)` if CEL/runtime support is confirmed

### List Methods

`dataRef`, `authRef`, `linkedDataRef`, and list-like attrs return list
expressions.

```ts
dr('memberships.user.id').contains(auth.id)
dr('memberships.user.id').isEmpty()
dr('memberships.user.id').isNonEmpty()
dr('memberships.user.id').size().lte(2)
ar('$user.roles.type').contains('admin')
```

List methods:

- `.contains(value)` -> emits `value in list`
- `.isEmpty()` -> emits `list == []`
- `.isNonEmpty()` -> emits `list != []`
- `.size()` -> emits `size(list)`
- `.at(index)` -> emits `list[index]`
- `.some((item) => expr)` -> emits CEL `.exists(...)`
- `.every((item) => expr)` -> emits CEL `.all(...)`

Example with a JSON-array terminal attr:

```ts
dr('ownedRole.types').some(types => types.contains('admin'))
```

This is intentionally different from:

```ts
dr('ownedRole.types').contains('admin')
```

If the terminal `types` attr is itself a JSON array, `data.ref('ownedRole.types')`
returns a list of terminal JSON values, for example `[['admin', 'editor']]`. It
does not flatten the inner array.

### Functional Helpers

Functional composition lives under `ctx.ops` and shorthand `ctx.f`.

```TS
.allow(({ f, b, d, rp }) => ({
  view: f.or(
    b.isAdmin,
    f.and(
      b.isMember,
      d.inviteCode.eq(rp('inviteCode')),
    ),
  ),
}))
```

Recommended helpers:

- `f.and(...exprs)`
- `f.or(...exprs)`
- `f.not(expr)`
- `f.eq(a, b)`
- `f.neq(a, b)`
- `f.gt(a, b)`
- `f.gte(a, b)`
- `f.lt(a, b)`
- `f.lte(a, b)`
- `f.in(item, list)`
- `f.contains(list, item)`
- `f.size(value)`
- `f.list(...values)`
- `f.str(value)`
- `f.num(value)`
- `f.bool(value)`
- `f.null()`

Rationale:

- fluent is best for subject-first rules
- functional is best for nested or n-ary composition
- `f` keeps destructured contexts compact
- `ops` gives the same surface a readable long name

### Raw Escape Hatch

Raw CEL should be explicit.

```TS
.allow(({ raw }) => ({
  view: raw("auth.email.endsWith('@company.com')"),
}))
```

Design notes:

- arbitrary strings should not be accepted as ordinary expressions by default
- `raw(...)` marks the unsafety at the call site
- a migration/compat mode may allow direct strings, but it should be opt-in
- raw expressions should still be parsed if a CEL parser is available in dev/test

## Action-Specific Stage And Bind

Common `.stage(...)` and `.bind(...)` callbacks should receive only common
context. That prevents `newData` and `linkedData` from leaking into rules where
Instant cannot evaluate them.

When aliasing action-specific logic is needed, use action-specific forms.

Action-specific staged values:

```ts
posts: e => e
  .stageFor('update', ({ d, nd }) => ({
    titleChanged: nd.title.neq(d.title),
  }))
  .allow(() => ({
    update: ({ s }) => s.titleChanged,
  }))
```

Action-specific binds:

```ts
posts: e => e
  .bind(({ auth, d }) => ({
    isOwner: auth.id.eq(d.ownerId),
  }))
  .bindFor('update', ({ auth, nd }) => ({
    isStillOwner: auth.id.eq(nd.ownerId),
  }))
  .allow(() => ({
    update: ({ b }) => b.isOwner.and(b.isStillOwner),
  }))
```

For link/unlink:

```ts
memberships: e => e
  .bindFor('link', 'user', ({ auth, ld }) => ({
    linksSelf: ld.id.eq(auth.id),
  }))
  .allow(() => ({
    link: {
      user: ({ b }) => b.linksSelf,
    },
  }))
```

Rules:

- action-specific stage names are authoring-only and only exposed in compatible
  action callbacks
- action-specific bind names still compile into the normal Instant `bind` block
- they are only exposed in compatible action callbacks
- nested action contexts include compatible common `stage`/`bind` values plus
  action-specific `stageFor`/`bindFor` values
- duplicate names across common and action-specific binds should be rejected
- `.overrideBind(...)` may explicitly replace inherited names

Implementation can defer `stageFor` / `bindFor` if phase 1 only targets common
rules, but the ideal API should leave room for it because Instant's own docs use
`newData` inside `bind`.

## Output Rules

The builder should emit plain `InstantRules<Schema>`.

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
- output should prefer CEL strings for maximum compatibility with current
  `InstantRules` types and existing tooling
- expression rendering should use deterministic parentheses
- generated CEL should be easy to inspect in diffs

## Rate Limits

The existing `InstantRules` shape supports `$rateLimits`. The authoring API
should expose both configuration and usage.

Configuration:

```ts
const rules = definePerms(schema)
  .rateLimits({
    createTask: {
      limits: [{ capacity: 10, refill: { period: '1 minute' } }],
    },
  })
  .ns
  .tasks(e => e.allow(({ rl, auth }) => ({
    create: rl.createTask.limit(auth.id),
  })))
  .toRules()
```

Usage should render to CEL:

```cel
rateLimit.createTask.limit(auth.id)
```

## Validation Rules

### Namespace Validation

- `.rules({ ... })` keys autocomplete from schema entities plus special
  namespaces
- `.ns.<namespace>(...)` properties autocomplete from schema entities
- unknown namespaces are TypeScript errors
- with `definePerms(schema)`, unknown namespaces can also throw runtime errors

### Attr Validation

- `ctx.data.<attr>` autocompletes attrs for the current entity
- `ctx.dataField('<attr>')` validates string literals against current entity
- `ctx.newData` is only available in update context
- `ctx.linkedData` is only available in link/unlink context

### Ref Path Validation

- `dataRef` starts from the current entity
- `linkedDataRef` starts from the linked entity
- `authRef` starts from `$users`; callers pass a `$user.`-prefixed path, matching
  Instant's `auth.ref('$user...')` requirement
- path traversal follows schema link labels
- the final segment must be an attr
- return type should be `ListExpr<TerminalAttrValue>`

### Context Validation

Invalid examples should fail at the cursor:

```ts
allow({
  view: ({ nd }) => nd.title.eq('x'),
  //      ^^ newData is not available in view
})

allow({
  update: ({ ld }) => ld.id.eq('x'),
  //        ^^ linkedData is not available in update
})
```

### Bind Validation

- duplicate bind names in the same scope fail
- duplicate bind names across inherited defaults and entity scope fail
- duplicate stage names follow the same rule
- `.overrideBind` and `.overrideStage` are explicit escape hatches
- cyclic bind dependencies should be detected if practical, or left to Instant
  validation with a clear error

## Full Example

This example mirrors the current demo shape: users, workspaces, memberships, and
tasks.

```ts
import { definePerms } from '@mszr/idb-vux/perms'
import schema from './instant.schema'

const rules = definePerms(schema)
  .attrs(a => a.allow({ create: false }))
  .defaults(d => d
    .bind(({ auth }) => ({
      isSignedIn: auth.id.neq(null),
    }))
    .allow({ $default: false }))
  .ns
  .$users(e => e
    .bind(({ auth, d, dr }) => ({
      isSelf: auth.id.eq(d.id),
      sharesWorkspace: dr('memberships.workspace.memberships.user.id').contains(auth.id),
    }))
    .allow(({ b }) => ({
      view: b.isSelf.or(b.sharesWorkspace),
      create: true,
      update: b.isSelf,
    }))
    .fields(({ b }) => ({
      email: b.isSelf.or(b.sharesWorkspace),
    })))
  .ns
  .workspaces(e => e
    .stage(({ rp, d }) => ({
      inviteCode: rp('inviteCode'),
      inviteMatches: rp('inviteCode').eq(d.inviteCode),
    }))
    .bind(({ auth, dr, s }) => ({
      isMember: dr('memberships.user.id').contains(auth.id),
      hasInviteCode: s.inviteCode.neq(null).and(s.inviteMatches),
    }))
    .allow(({ b }) => ({
      view: b.isMember.or(b.hasInviteCode),
      create: b.isSignedIn,
      update: b.isMember,
      delete: b.isMember,
    })))
  .ns
  .memberships(e => e
    .bind(({ auth, dr, rp }) => ({
      isMember: dr('workspace.memberships.user.id').contains(auth.id),
      isSelf: dr('user.id').contains(auth.id),
      hasInviteCode: rp('inviteCode').neq(null).and(dr('workspace.inviteCode').contains(rp('inviteCode'))),
    }))
    .allow(({ b }) => ({
      view: b.isMember,
      create: b.isSignedIn,
      update: b.isSelf,
      delete: b.isSelf,
      link: {
        user: ({ auth, ld }) => ld.id.eq(auth.id),
        workspace: ({ rp, ld }) => b.isMember.or(
          rp('inviteCode').neq(null).and(ld.inviteCode.eq(rp('inviteCode'))),
        ),
      },
      unlink: {
        user: b.isSelf,
        workspace: b.isSelf,
      },
    })))
  .ns
  .tasks(e => e
    .bind(({ auth, dr }) => ({
      isMember: dr('workspace.memberships.user.id').contains(auth.id),
    }))
    .allow(({ b }) => ({
      view: b.isMember,
      create: b.isSignedIn.and(b.isMember),
      update: b.isMember,
      delete: b.isMember,
      link: {
        workspace: b.isMember,
        assignee: ({ ld, dr }) => b.isMember.and(
          dr('workspace.memberships.user.id').contains(ld.id),
        ),
      },
      unlink: {
        workspace: false,
        assignee: b.isMember,
      },
    })))
  .toRules()

export default rules
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
  // ...ordinary Instant namespace rules...
}
```

## Implementation Notes

### Expression Nodes

Each helper should return a small immutable expression node:

```ts
interface Expr<T> {
  kind: string
  type: T
  render: () => string
}
```

In practice, `type` is phantom type information. Runtime nodes need enough
metadata to render CEL and validate obvious local mistakes.

### Renderer

Renderer responsibilities:

- escape string literals
- render booleans and null
- render property access
- render function calls
- render binary operators with deterministic parentheses
- render CEL list macros for `.some` and `.every`
- render bind alias references as bare identifiers

### Type Depth

Ref path autocomplete should be deep enough to be useful and shallow enough not
to punish TypeScript.

Recommended starting point:

- direct attrs: all attrs
- ref paths: up to 4 link hops plus terminal attr
- escape hatch: `dataRef.raw(path)` or `raw(...)` for paths beyond TS limits

### Development Validation

With `definePerms(schema)`, dev builds can validate:

- namespace exists
- attr exists
- ref path exists
- ref path terminal is an attr
- linkedData ref path starts from the linked namespace
- duplicate stage/bind keys
- action-specific context misuse if runtime metadata is present

### Compatibility

The generated object should be assignable to:

```ts
InstantRules<AppSchema>
```

No backend changes should be required.

## Proposed Build Order

1. Expression AST and CEL renderer.
2. `definePerms(schema).rules({ ... })`.
3. Common context, direct attrs, `dataField`, `dataRef`, `authRef`, `ruleParam`.
4. `.stage`, `.bind`, `.allow`, `.fields`.
5. Default inheritance and duplicate checking.
6. Action callback form for `newData` and `linkedData`.
7. List helpers: `.contains`, `.isEmpty`, `.isNonEmpty`, `.size`, `.some`,
   `.every`.
8. `ctx.f` / `ctx.ops` functional helpers.
9. `.attrs`, `.defaults`, `$rateLimits`.
10. `.ns.<namespace>(...).toRules()` chain syntax.
11. Runtime schema validation diagnostics.
12. Optional compat mode for direct raw strings.
