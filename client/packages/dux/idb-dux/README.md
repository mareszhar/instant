# @mszr/idb-dux

**A DX/UX-first reimagining of the InstantDB developer experience.**

dux keeps Instant's backend, wire protocol, and rules engine exactly as they are, and rebuilds the authoring and client surface around a single question: *what would feel most delightful to use?*

> **Status: pre-implementation.** The package is scaffolded and spec-complete; the surfaces below land phase by phase. The specs are the source of truth: start at [`dux-vision.md`](../docs/dux-vision.md).

## The shape

One package, six entrypoints. The root is the framework-agnostic foundation; everything else is a thin overlay on it.

| Entrypoint | What it is |
|---|---|
| `@mszr/idb-dux` | schema authoring (`defineSchema`, `i`), query authoring (`q`), typed tx, the `Idb*` type utilities |
| `@mszr/idb-dux/vue` | the Vue client: `init`, `defineDb`, the enhanced db, components — SSR-resilient by default |
| `@mszr/idb-dux/perms` | typed CEL authoring (`definePerms`) — compiles to the rules object Instant already accepts |
| `@mszr/idb-dux/admin` | the full server surface over `@instantdb/admin` |
| `@mszr/idb-dux/webhooks` | webhook handling + management — admin-free by design |
| `@mszr/idb-dux/nuxt` | server glue: `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler` |

`sideEffects: false` and disjoint module graphs mean a Vue-only app pays zero bytes for the server planes, and a webhook-only worker installs nothing from the Vue stack. Subpath-only dependencies (`vue`, `h3`, `@instantdb/admin`, `@instantdb/webhooks`) are optional peers — you install only what your entrypoints need.

## A taste

```ts
// Queries destructure directly — no unwrapping, no ?? [] massaging
const { workspace, todos } = db.useQuery({
  workspaces: { $: { where: { id: workspaceId }, $only } }, // Workspace | undefined
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

**dux owes behavioral compatibility to Instant's backend, not API compatibility to Instant's SDKs.** Everything dux emits — schema shapes for the CLI, perms CEL, wire queries — is something Instant already accepts. Inside that envelope, dux is free to be better.

## Docs

- [`dux-vision.md`](../docs/dux-vision.md) — philosophy, architecture, scope, roadmap
- [`dux-conventions.md`](../docs/dux-conventions.md) — vocabulary and naming law
- `dux-spec-*.md` — one spec per entrypoint, plus the maintainer manual
