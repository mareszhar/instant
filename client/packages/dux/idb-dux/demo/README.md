# idb-dux demo

A minimal Nuxt 4 app that exercises the **five interactively-demoable** `@mszr/idb-dux` entrypoints in a realistic setup:

- **root** — `defineSchema` + registration, the ready-made `q`, typed `db.tx` (dot-path `.link`, schema-typed `ruleParams`), `$skip`
- **`/vue`** — `init`, `useQuery`/`useInfiniteQuery`/`queryOnce`, `useAuth`, rooms (presence, topics, typing, cursors), `SignedIn`/`SignedOut`/`Cursors`
- **`/perms`** — `definePerms(schema)` in `config/instant.perms.ts`
- **`/admin`** — server summary + cleanup routes over the dux admin db
- **`/nuxt`** — `defineServerKit`, `defineAuthSyncHandler`

`/webhooks` (and `/nuxt`'s `defineWebhookHandler`) is **supported but intentionally not demoed here** — see [Webhooks](#webhooks) below.

## Prerequisites

- An Instant app ID and admin token (see `.env.example` → `.env`)

## Setup

```bash
bun install
```

## Run

```bash
bun run dev
```

Then open `http://localhost:3000`. Open a second tab to see realtime sync, presence, and cursors.

## Webhooks

`@mszr/idb-dux/webhooks` (handling + `manager`) and `/nuxt`'s `defineWebhookHandler` are **fully supported** — they're just not part of this interactive demo, on purpose.

This demo's one rule is that no visitor can affect another's experience: everything is scoped per workspace. Instant webhooks don't fit that model, because a subscription is an **app-level** primitive (`url + namespaces + actions`, with no per-user/per-workspace filter). Exposing subscription management to visitors would be globally destructive (one visitor could receive, delete, or exhaust everyone's), and the realistic alternative — an operator provisioning one app-owned subscription whose deliveries are server-to-server — has nothing a visitor can meaningfully and safely *try* in the browser without contriving an unrealistic, non-idiomatic setup (e.g. denormalizing foreign keys onto entities just to route deliveries). A demo example should look like a real project; this one wouldn't.

So webhooks earn their guarantee where it's actually airtight — the test suites:

- dispatch parity against the official pipeline, resolution order, and retry semantics, plus `verify` reaching the real verifier (`idb-dux/src/webhooks/webhooks.test.ts`)
- the `defineWebhookHandler` route driven through h3's real request lifecycle with 2xx/4xx retry mapping (`idb-dux/src/nuxt/nuxt.test.ts`)
- type, editor-DX, and official-shape compatibility planes (`idb-dux/src/webhooks/*.test-d.ts`, `*.dx.test.ts`)

To use webhooks in a real app, see [`dux-spec-webhooks.md`](https://github.com/mareszhar/instant/blob/dux/client/packages/dux/docs/dux-spec-webhooks.md) and [`dux-spec-nuxt.md`](https://github.com/mareszhar/instant/blob/dux/client/packages/dux/docs/dux-spec-nuxt.md).

## Build preview

```bash
bun run build
bun run prev
```

## Dependency resolution

The public demo resolves `@mszr/idb-dux` from npm. Link and tarball modes are maintainer workflows in the dux workspace inside the Instant fork.
