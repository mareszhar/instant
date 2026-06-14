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

The Webhooks panel manages subscriptions through `adminDb.webhooks.manager` and points them at this app's own `/api/webhooks/receive` route. For Instant's backend to reach a local server, expose it with a public tunnel (e.g. `ngrok http 3000`) and subscribe from the tunnel origin.

## Build preview

```bash
bun run build
bun run prev
```

## Dependency resolution

This demo resolves `@mszr/idb-dux` (and the Instant peers) via one of three possible modes: **links**, **tarballs**, or **npm**. To switch the resolution mode, see the orchestrator scripts in the maintainer workspace's `package.json`.
