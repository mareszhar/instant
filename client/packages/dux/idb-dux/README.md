# @mszr/idb-dux

**A DX/UX-first reimagining of the InstantDB developer experience.**

dux keeps Instant's backend intact but rebuilds the authoring and client surface around a single question: *what would feel most delightful to use?*

## Highlights

🔮 **Typed perms authoring** — `definePerms` replaces stringly-typed CEL with a schema-aware TypeScript surface. Write rules against real field names and link traversals; it compiles to exactly what Instant accepts. Completions, narrowing, and type errors on the authoring side — before anything reaches the backend.

⛱️ **One registration, project-wide types** — register your schema once next to `defineSchema` and every `Idb*` type utility knows it project-wide. No `SomeUtil<AppSchema, 'namespace', { /* finally my shape */ }>` threading — just `IdbQueryEntity<'todos', { assignee: {} }>`.

🍬 **`q` — a typed query builder that goes anywhere** — write queries in stores, composables, utilities, and factory callbacks and get completions, field validation, and operator checking at every level. The query object is fully typed before it ever reaches a `useQuery` or `query` call.

👽 **Typed tx and linking** — official linking requires `lookup('email', val)` with no validation on the field name or value type. dux's `.link()` knows your schema: link labels are suggested, and field-matched linking (`.link({ 'assignee.email': val })`) is narrowed to the linked namespace's field types, and validated.

🎈 **Errors at the cursor, not the console** — the wrong field name, invalid operator, or unknown namespace underlines exactly where the mistake is, with a message that says what's wrong and points you in the right direction. Completions and diagnostics are regression-tested with `selenita` so your DX has the same guarantees as runtime behaviors.

💫 **Results without ceremony** — query scopes arrive typed and normalized: arrays are never `undefined`; `$only` narrows a scope to `T | undefined` so you never reach for `?.[0]`; `$as` and `$m` let you reshape in the query instead of after it.

👻 **SSR-resilient by default** — every hook returns safe inert state on the server and activates full subscriptions on the client. Zero configuration. Full support incoming when upstream marks SSR stable.

## Install

```bash
npm install @mszr/idb-dux
```

`@instantdb/core` comes along as a dependency. Everything else is an **optional peer** you add only for the entrypoints you use:

```bash
npm install vue                          # for /vue
npm install @instantdb/admin             # for /admin
npm install @instantdb/webhooks          # for /webhooks
npm install @instantdb/admin @instantdb/webhooks h3   # for /nuxt
```

The root and `/perms` need no peers.

## The shape

One package, six entrypoints. The root is the framework-agnostic foundation; everything else is a thin overlay on it.

| Entrypoint | What it is |
|---|---|
| `@mszr/idb-dux` | schema authoring (`defineSchema`, `i`), query authoring (`q`), typed tx, the `Idb*` type utilities |
| `@mszr/idb-dux/perms` | typed CEL authoring (`definePerms`) — compiles to the rules object Instant already accepts |
| `@mszr/idb-dux/admin` | the full server surface over `@instantdb/admin` |
| `@mszr/idb-dux/webhooks` | webhook handling + management — admin-free by design |
| `@mszr/idb-dux/vue` | the Vue client: `init`, `defineDb`, the enhanced db, components — SSR-resilient by default |
| `@mszr/idb-dux/nuxt` | utils for nuxt server: `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler` |

`sideEffects: false` and disjoint module graphs mean a Vue-only app pays zero bytes for the server planes, and a webhook-only worker installs nothing from the Vue stack. Subpath-only dependencies (`vue`, `h3`, `@instantdb/admin`, `@instantdb/webhooks`) are optional peers — you install only what your entrypoints need.

## A taste

```ts
// Queries destructure directly — no unwrapping, no ?? [] massaging
const { workspace, todos } = db.useQuery({
  workspaces: { $: { where: { id: workspaceId }, $only } }, // Workspace | undefined (automagically singularized, customizable)
  todos: {}, // Todo[] — never undefined
})
```

```ts
// One declaration; every Idb* type utility and `q` know your schema project-wide
declare module '@mszr/idb-dux' {
  interface IdbRegister { schema: typeof schema }
}
```

## The one hard contract

**dux owes behavioral compatibility to Instant's backend, not API compatibility to Instant's SDKs.** Everything dux emits — schema shapes for the CLI, perms CEL, wire queries — is something Instant already accepts. Inside that envelope, dux is free to reimagine the ergonomics.

## Development

The public `idb-dux` repo is the package and demo face, not the standalone development workspace. Build, test, release, and demo-resolution commands live in the dux maintainer workspace inside the Instant fork: `client/packages/dux` ([public link](https://github.com/mareszhar/instant/tree/dux/client/packages/dux) | [local fork path](..)).

## Docs

- `dux-vision.md` ([public link](https://github.com/mareszhar/instant/blob/dux/client/packages/dux/docs/dux-vision.md) | [local fork path](../docs/dux-vision.md)) — philosophy, architecture, scope, roadmap
- `dux-conventions.md` ([public link](https://github.com/mareszhar/instant/blob/dux/client/packages/dux/docs/dux-conventions.md) | [local fork path](../docs/dux-conventions.md)) — vocabulary and naming law
- `dux-spec-*.md` ([public link](https://github.com/mareszhar/instant/tree/dux/client/packages/dux/docs) | [local fork path](../docs)) — one spec per entrypoint, plus the maintainer manual
