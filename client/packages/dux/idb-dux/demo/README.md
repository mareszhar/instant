# idb-dux demo

A minimal Nuxt 4 app that exercises **every** `@mszr/idb-dux` entrypoint in a realistic setup:

- **root** — `defineSchema` + registration, the ready-made `q`, typed `db.tx` (dot-path `.link`, schema-typed `ruleParams`), `$skip`
- **`/vue`** — `init`, `useQuery`/`useInfiniteQuery`/`queryOnce`, `useAuth`, rooms (presence, topics, typing, cursors), `SignedIn`/`SignedOut`/`Cursors`
- **`/perms`** — `definePerms(schema)` in `config/instant.perms.ts`
- **`/admin`** — server summary + cleanup routes over the dux admin db
- **`/webhooks`** — `defineWebhookHandlers` + `adminDb.webhooks.manager`
- **`/nuxt`** — `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler`

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

Instant webhooks are an **app-level** primitive — a subscription is `url + namespaces + actions`, with no per-user or per-workspace filter. So the demo does **not** let visitors create them (one visitor could then receive, delete, or exhaust everyone's): a maintainer provisions a single app-owned subscription once, and the receiver fans each delivery out to the workspace that caused it. Visitors only ever see their own workspace's deliveries — the same isolation the rest of the demo relies on.

Provision the subscription against the deployed origin (or a public tunnel for local dev, e.g. `ngrok http 3000`):

```bash
bun run webhook:ensure https://your-origin.example/api/webhooks/receive
```

It's idempotent (uses `adminDb.webhooks.manager.list`/`create`). The Webhooks panel then shows the subscription read-only and a live, workspace-scoped feed of deliveries (persisted as `webhookEvents`), so add/complete/delete a task to watch one land.

## Build preview

```bash
bun run build
bun run prev
```

## Dependency resolution

This demo resolves `@mszr/idb-dux` (and the Instant peers) via one of three possible modes: **links**, **tarballs**, or **npm**. To switch the resolution mode, see the orchestrator scripts in the maintainer workspace's `package.json`.
