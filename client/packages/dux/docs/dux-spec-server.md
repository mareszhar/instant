updated: 2026-06-30
status: spec — contracts are binding; implementation approaches are proposals in their service

# dux spec — `/server`

The server plane: a framework-agnostic core (`/server`) plus thin per-framework adapters (`/h3-v1`, `/h3`, `/hono`, `/elysia`). The three utilities — `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler` — wire a request lifecycle onto `/admin` and `/webhooks`. They own no data-plane or verification logic of their own; the data plane is `/admin`'s, the signature pipeline is `/webhooks`'s. What the server plane owns is the *seam*: how a request carries auth, and how a framework's request/response object maps onto that seam.

Conventions: [dux-conventions.md](./dux-conventions.md) · Principles: [dux-vision.md §2](./dux-vision.md#2-design-principles) · Wrapped layers: [dux-spec-admin.md](./dux-spec-admin.md), [dux-spec-webhooks.md](./dux-spec-webhooks.md)

## Implementation status

| Phase | Scope | Status |
|---|---|---|
| S1 | `/server` core + the adapter port; request-scoped state | ☑ complete |
| S2 | `/h3-v1` adapter (Nuxt 4 / Nitro 2; replaces `/nuxt`) | ☑ complete |
| S3 | `/h3` adapter (h3 v2 / Nitro 3 / **h3-dux**) | ☐ planned — needs the `h3@^2` peer (cannot co-install with v1) |
| S4 | `tokenFrom` transports: cookie · bearer · cookieOrBearer · custom | ☑ complete |
| S5 | `/hono` adapter | ☑ complete |
| S6 | `/elysia` adapter | ☑ complete |
| S7 | `db.getCurrentRefreshToken()` in `/vue`; bearer pattern documented | ◧ method shipped; demo example pending |

Details: [§11 Phased roadmap](#11-phased-roadmap).

- [1. Scope](#1-scope)
- [2. Three backends, two transports](#2-three-backends-two-transports)
- [3. `/server` — the framework-agnostic core](#3-server--the-framework-agnostic-core)
- [4. `defineServerKit`](#4-defineserverkit)
- [5. `defineAuthSyncHandler`](#5-defineauthsynchandler)
- [6. `defineWebhookHandler`](#6-definewebhookhandler)
- [7. The client half — bearer transport](#7-the-client-half--bearer-transport)
- [8. Mounting per framework](#8-mounting-per-framework)
- [9. Boundary law and file layout](#9-boundary-law-and-file-layout)
- [10. Naming](#10-naming)
- [11. Phased roadmap](#11-phased-roadmap)

---

## 1. Scope

One framework-agnostic core, four adapters, three utilities exposed by each adapter.

| Subpath | Role | Peers (all optional) |
|---|---|---|
| `@mszr/idb-dux/server` | the adapter port + the framework-agnostic cores; **no framework peer** | `@instantdb/admin`, `@instantdb/webhooks` |
| `@mszr/idb-dux/h3-v1` | h3 v1 adapter — Nuxt 4 / Nitro 2 | `h3@^1.15` + admin + webhooks |
| `@mszr/idb-dux/h3` | h3 v2 adapter — standalone h3, Nitro 3, Nuxt 5, **h3-dux** | `h3@^2` + admin + webhooks |
| `@mszr/idb-dux/hono` | Hono adapter | `hono@^4` + admin + webhooks |
| `@mszr/idb-dux/elysia` | Elysia adapter | `elysia@^1` + admin + webhooks |

| Utility | Purpose |
|---|---|
| `defineServerKit(config)` | per-request kit: `{ adminDb, user?, userDb? }` by mode; request-scoped caching; reads the token via `tokenFrom`; wraps `/admin` |
| `defineAuthSyncHandler(config)` | the `firstPartyPath` auth-sync route; token-only cookie. **Cookie transport only** — there is nothing to sync for bearer clients |
| `defineWebhookHandler(handlers, opts?)` | the one-line webhook route over `/webhooks` |

Every adapter exposes the same three names with the same contracts. What differs is the request object the handler receives (`H3Event`, Hono `Context`, Elysia `Context`) and the native handler shape the utility returns — bound by the subpath, invisible at the call site.

**Why a version split for h3.** h3 v1 and v2 diverge exactly where the server plane is coupled: v2 removed `readRawBody` (raw text is `event.req.text()`) and `setResponseStatus` (status is `event.res.status`), and reshaped the event onto web standards. A single subpath cannot span both, and `peerDependencies` is package-wide. The split isolates the difference to one adapter file each; the core is shared.

**Why no `/h3-dux` subpath.** h3-dux's `H3DuxEvent` extends `H3Event`, and every utility h3-dux ships accepts an `H3Event` unchanged. The `/h3` adapter therefore covers h3-dux with no extra surface. A dedicated subpath would earn its place only if a server utility needed to *emit* h3-dux's own response niceties — none does.

## 2. Three backends, two transports

A cross-platform product (web, PWA, native shells, browser extension, watch) talks to three kinds of backend. Only one of them is the server plane's concern.

| Backend | Who authenticates | Server plane's job |
|---|---|---|
| **Instant** (`db.useQuery`, `db.auth`) | the dux client, directly, on every surface — no cookies, no config | none |
| **your `/api`** (an app's own server routes; deployed, never shipped inside a shell) | a request that carries the user's refresh token | read + verify the token |
| **your shared backend** (`api.acme.com`; admin-token business logic) | same | same |

Authenticating with Instant needs no custom code — Instant's auth methods own that flow, and the client holds the resulting `refresh_token` in memory (it is part of the `user` from `db.useAuth`). The only question the server plane answers is: **how does that token reach a route on your backend, so the route can `verifyToken` it.** Two transports:

| Transport | How the token travels | Fits | Ceremony |
|---|---|---|---|
| **cookie** | httpOnly cookie set by `defineAuthSyncHandler`; the browser attaches it automatically | web, **same-origin only** | none after setup |
| **bearer** | `Authorization: Bearer <token>`, attached by the client | native shells, the extension, the watch, and **any cross-origin** backend (`api.acme.com`) | a client fetch wrapper |

**Cookie is same-origin only — by construction.** Instant's client posts the `firstPartyPath` sync without `credentials: 'include'`, so a cross-origin sync never stores the cookie. A native shell runs on a non-web origin (`capacitor://…`, `electron`, `localhost`) and a shared backend is cross-origin even to web apps. Both fall outside cookie's reach. Bearer is the transport that spans every surface.

**httpOnly buys nothing extra here.** An httpOnly cookie protects the token only when the token is otherwise absent from JavaScript. Instant already exposes the same `refresh_token` to JavaScript via `db.useAuth`, so a JS-readable copy exists regardless of transport; an XSS attacker reads it from the client either way. The cookie's only real advantage is the auto-attach ergonomics — not a security tier. Bearer is a peer transport, chosen per surface, not a downgrade.

**The default reads both.** `defineServerKit`'s `tokenFrom` defaults to `'cookieOrBearer'`, so one deployment serves cookie web clients and bearer shells with no per-deployment switch ([§4](#4-defineserverkit)). The per-surface choice lives in the *client* build ([§7](#7-the-client-half--bearer-transport)), never in the server route.

## 3. `/server` — the framework-agnostic core

`/server` holds everything the four adapters share: the request lifecycle of all three utilities, the modes, the token resolution, the cookie-name derivation, request-scoped caching, and the admin/webhooks composition. It imports no framework. An adapter is the thin translation between one framework's request object and the port below.

### 3.1 The adapter port

`IdbDuxServerAdapter<Ctx>` is the complete operation set the cores need over a per-request object `Ctx`. The core touches `Ctx` only through this port — never its fields — which is what keeps the core framework-agnostic and `Ctx` an opaque type parameter.

```TS
export interface IdbDuxServerAdapter<Ctx> {
  // request reads
  getCookie: (ctx: Ctx, name: string) => string | undefined
  getHeader: (ctx: Ctx, name: string) => string | undefined
  readJsonBody: <T>(ctx: Ctx) => Promise<T> // parse failure rejects → core maps to 400
  readRawText: (ctx: Ctx) => Promise<string> // exact bytes; webhook signatures need them
  // request-scoped state bag — one per request, mutable, for memoization
  state: (ctx: Ctx) => Record<string, unknown>
  // response writes
  setCookie: (ctx: Ctx, name: string, value: string, opts: IdbServerCookieOptions) => void
  deleteCookie: (ctx: Ctx, name: string, opts: IdbServerCookieOptions) => void
  setStatus: (ctx: Ctx, code: number) => void
  httpError: (code: number, message: string) => unknown // returns the value the handler throws
}
```

The cores are `(adapter, config) → (ctx) => result` factories: `createServerKit`, `createAuthSyncHandler`, `createWebhookHandler`. Each adapter binds its `adapter` and re-exports `defineServerKit` / `defineAuthSyncHandler` / `defineWebhookHandler`, wrapping the core handler in the framework's native handler shape (a bare `(event) => …` on `/h3`, a `defineEventHandler(…)` on `/h3-v1`, a `(c) => Response` on `/hono` and `/elysia`). A core handler returns a plain JSON-able value and signals status via `adapter.setStatus`; the adapter renders that value the framework way (returned directly on h3, `c.json(value)` on hono/elysia).

### 3.2 Request-scoped state

`adapter.state(ctx)` returns one mutable bag per request — the substrate for principle 8 (per-event work happens once): `defineServerKit` caches the parsed token, the single in-flight verification promise, and the per-request `userDb` there, so repeated kit calls in one request reuse them and concurrent calls share one verification.

The bag is native where the framework has one (`event.context` on h3) and a `WeakMap` keyed on the underlying web `Request` otherwise. The portable `WeakMap` default works on every web-standard framework, so caching semantics are identical across adapters — verified once, asserted in the shared conformance suite ([§9](#9-boundary-law-and-file-layout)).

### 3.3 Bring your own adapter

`IdbDuxServerAdapter` and the three `create*` cores are public. The port is nine operations over a request object — express, Fastify, or any other framework gets full server-plane support by supplying an adapter, with no dependency on dux shipping one. Web-standard frameworks need only map to the web `Request`/`Response`; node-native ones map their `req`/`res`. dux ships and supports the four adapters in [§1](#1-scope); the rest is the port's to enable.

## 4. `defineServerKit`

### The contract

Server routes get the client's DX: one factory at module scope, one `await` in the route, typed results — and the route *declares its auth strictness* (the mode) instead of hand-rolling token reads, verification, and 401s.

```TS
// server/utils/idb.ts — the request-kit factory (h3-v1 / Nuxt 4 shown)
import { defineServerKit } from '@mszr/idb-dux/h3-v1'
import { schema } from '~~/config/instant.schema'

export const useServerKit = defineServerKit({
  schema,
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
  getAdminToken: event => useRuntimeConfig(event).instantAdminToken,
  // tokenFrom defaults to 'cookieOrBearer' — this same factory authenticates
  // cookie web requests and bearer shell requests with no change.
})
```

```TS
// In a route — the kit's keys vary by mode
const { adminDb, user } = await useServerKit(event, 'user?')

const { workspaces } = await adminDb.query(q({
  workspaces: { $: { where: { 'memberships.user': user?.id ?? $skip } }, memberships: {} },
}))
// workspaces: Workspace[] — the data plane is /admin's, shaping and all
```

Binding behaviors:

- **Keys vary by mode, typed accordingly.** Strictness is declared at the call site; the types follow. No manual narrowing, no repeated 401 boilerplate.
- **Request-scoped caching.** Repeated `useServerKit(event, …)` calls in one request reuse the token read and the verification promise ([§3.2](#32-request-scoped-state)).
- **Lazy config.** `getAppId` / `getAdminToken` receive the request, so runtime-config resolution works without module-load-time values.
- **Transport-blind.** The kit reads the token via `tokenFrom` and is otherwise identical across cookie and bearer. One factory, every surface.

### Modes

| Mode | Kit | Behavior |
|---|---|---|
| *(none)* | `{ adminDb }` | no auth work performed |
| `'user?'` | `{ adminDb, user: IdbAuthUser \| undefined }` | reads + verifies the token if present |
| `'user'` | `{ adminDb, user: IdbAuthUser }` | missing/invalid token → throws the adapter's 401 |
| `'userDb?'` / `'userDb'` | adds `userDb` — `adminDb.asUser({ token })`-scoped | per-request permission-scoped db, same optional/required split |

### `tokenFrom` — where the refresh token is read

`tokenFrom` declares the transport. A string is the common case (no import); an object overrides names; a function takes full control. Default `'cookieOrBearer'`.

```TS
/** Where defineServerKit reads the user's Instant refresh token. Default 'cookieOrBearer'. */
export type IdbServerTokenSource
  = | IdbServerTokenTransport // 'cookie' | 'bearer' | 'cookieOrBearer'
    | { transport?: IdbServerTokenTransport, cookieName?: string } // preset + custom cookie name
    | { header: string } // a custom header carries the raw token
    | ((req: IdbServerRequestReader) => string | undefined) // bring-your-own resolver

export type IdbServerTokenTransport = 'cookie' | 'bearer' | 'cookieOrBearer'
```

- `'cookie'` — read cookie `instant_token_<appId>`. Web, same-origin.
- `'bearer'` — read `Authorization: Bearer <token>`. Cross-platform.
- `'cookieOrBearer'` — cookie first, else bearer. Serves both from one route. The default.
- `{ transport, cookieName }` — a preset with a custom cookie name (`{ cookieName: 'acme_session' }` keeps `cookieOrBearer` and renames the cookie).
- `{ header }` — a non-standard header (`{ header: 'x-acme-token' }`) carries the raw token.
- `(req) => …` — anything else.

`IdbServerRequestReader` is a small dux facade — **not** a web `Request`. It exposes only what a resolver needs, framework-agnostically:

```TS
export interface IdbServerRequestReader {
  cookie: (name: string) => string | undefined // a request cookie by name
  header: (name: string) => string | undefined // a request header by name (case-insensitive)
  appId: string // the resolved app id for this request
}
```

The cookie name in every preset defaults to `instant_token_<appId>` and stays consistent with `defineAuthSyncHandler`'s default ([§5](#5-defineauthsynchandler)) so cookie write and cookie read agree without configuration.

### `apiURI`

The base URL of the **Instant API**, passed to the admin client — set it only when self-hosting Instant instead of Instant Cloud. It is unrelated to your own backend's URL. Kept verbatim: `apiURI` is idb's own config key (`@instantdb/admin`), already exposed unchanged by `/admin`, `/webhooks`, and `/vue` — the native-key parity rule ([dux-conventions.md §5](./dux-conventions.md#5-native-keys-and-wrapped-verbs)) keeps it the same word everywhere.

## 5. `defineAuthSyncHandler`

### The contract

The route for Instant's `firstPartyPath` auth sync — one line to mount.

```TS
// server/api/idb.post.ts (Nuxt 4) — and point the client's firstPartyPath at this route
export default defineAuthSyncHandler({
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
})
```

The Instant client POSTs `{ type: 'sync-user', appId, user }` to its `firstPartyPath` on every auth change (and a daily timer). This handler validates the `appId` and `type`, then writes or clears the cookie.

**Cookie transport only.** This utility exists to set a cookie. Bearer clients have nothing to sync — they hold the token and attach it themselves — so a bearer-only backend does not mount it. This is a property of the transport, not a limitation.

**Intentional cookie divergence.** The official handler stores the full user JSON in `instant_user_<appId>`. dux stores only the `refresh_token` in `instant_token_<appId>` — a smaller cookie, less user data on the wire; the kit re-derives the user from the token. `createInstantRouteHandler` stays re-exported for the official shape (and official `getUserFromRequest` compatibility, [dux-spec-admin.md §5](./dux-spec-admin.md#5-asuser-and-the-pass-throughs)).

### Customization

```TS
export interface IdbAuthSyncConfig<Ctx> {
  getAppId: (event: Ctx) => string
  /** Cookie name to write/clear. Default `instant_token_<appId>` — match `tokenFrom`'s. */
  cookieName?: string
  /** Override cookie attributes — sameSite/secure/domain/path/maxAge. */
  cookie?: Partial<IdbServerCookieOptions>
  /**
   * Full control: receive the refresh token (or `undefined` to clear) and persist it
   *  however you like — custom name, expiry, store. When provided, the default
   *  cookie write/clear is skipped; appId/type validation and the response are not.
   */
  persistToken?: (token: string | undefined, event: Ctx) => void | Promise<void>
}
```

```TS
export interface IdbServerCookieOptions {
  path: string // default '/'
  httpOnly: boolean // default true
  secure: boolean // default true
  sameSite: 'strict' | 'lax' | 'none' // default 'strict'
  maxAge: number // default 604800 (7 days), matching the official handler
  domain?: string // unset by default (host-only)
}
```

`cookieName` and `cookie` cover the declarative cases; `persistToken` is the escape hatch — the cookie-side analog of `tokenFrom`'s resolver function. Defaults match the official handler's attributes.

### Setup expectations

The cookie path is one mechanism among many a route might use, so the server plane documents the common wiring rather than enforcing one shape:

- A `defineServerKit` reading `'cookie'` (or `'cookieOrBearer'`) expects a `firstPartyPath` endpoint to be setting that cookie — `defineAuthSyncHandler` is the ready-made one, but a hand-rolled route is equally valid.
- When both sides name a custom cookie, the names must agree (`tokenFrom: { cookieName }` ↔ `defineAuthSyncHandler({ cookieName })`).
- A bearer-only `tokenFrom` does not imply the route never sets a cookie — an app may still mount `defineAuthSyncHandler` for a different consumer. The utilities compose freely; dux warns in docs, not at runtime.

## 6. `defineWebhookHandler`

### The contract

A webhook route is one line, with official retry semantics intact.

```TS
// server/api/webhooks.post.ts
export default defineWebhookHandler(handlers)
```

- Reads the raw body the framework way (signature verification needs the exact bytes), delegates verify → fetch → dispatch to `/webhooks`, and answers 2xx/4xx per official retry semantics (handler rejection → non-2xx → Instant retries).
- The singular/plural pairing is deliberate grammar: `defineWebhookHandlers` (in `/webhooks`) authors the *many* handlers; `defineWebhookHandler` is the *one* route that receives them — `defineWebhookHandler(defineWebhookHandlers({ … }))` reads as exactly what it does.

### Raw body across adapters

Signature bytes must be the untouched body, which constrains how each adapter reads it:

- **h3 v1** — `readRawBody(event, 'utf8')`.
- **h3 v2** — `event.req.text()`.
- **Hono** — `c.req.text()` (a single read; the handler never also parses the body).
- **Elysia** — Elysia parses `body` eagerly, consuming the stream, so the route opts into raw text: `defineWebhookHandler(handlers)` is mounted with `{ parse: 'text' }`. This is the one adapter-specific requirement; it is documented at the mount, not hidden ([§8](#8-mounting-per-framework)).

## 7. The client half — bearer transport

The server plane reads whichever transport arrives. The *client* decides which to send, and that decision is the only thing that differs between an app's web build and its shell build. The same app — one Nuxt codebase — ships to `app.acme.com` and compiles to Capacitor/Electron; the shell build drops the `server/` directory entirely and talks to the deployed backend as a remote client.

### One init, two builds

```TS
// app's idb client — branches once on the build target
const isShell = !!import.meta.env.VITE_ACME_SHELL // set only in the Capacitor/Electron builds

export const useDb = defineDb({
  schema,
  getAppId: () => useRuntimeConfig().public.instantAppId,
  ...(isShell ? {} : { firstPartyPath: '/api/idb' }), // cookie sync: web, same-origin only
})

export const apiBase = isShell ? 'https://app.acme.com' : '' // '' = same-origin
```

- **Web build** sets `firstPartyPath` to a same-origin route → the sync handler sets the cookie → the browser attaches it → `defineServerKit` reads `'cookie'`. Zero per-request client code.
- **Shell build** omits `firstPartyPath` (a cross-origin cookie cannot stick) → the client holds the token and attaches it as bearer → `defineServerKit` reads `'bearer'`.

`db.useQuery` and the rest of the realtime surface authenticate to Instant directly and are unaffected by either choice — the transport question is only about requests to *your* backend.

### Attaching the bearer — the documented pattern

There is no single right shape for the authed client: a Nuxt app augments `$fetch`; an app on a typed h3-dux/Hono client configures that client's transport. The principle is constant — **wrap or configure the fetcher to attach the current refresh token on requests to your `/api` and your shared backend**:

```TS
// a Nuxt plugin augmenting $fetch (illustrative)
export default defineNuxtPlugin(() => {
  const db = useDb()
  const api = $fetch.create({
    baseURL: apiBase,
    async onRequest({ options }) {
      const token = await db.getCurrentRefreshToken() // dux convenience over the user's refresh_token
      if (token)
        options.headers.set('Authorization', `Bearer ${token}`)
    },
  })
  return { provide: { api } } // useNuxtApp().$api — authed everywhere
})
```

`db.getCurrentRefreshToken(): Promise<string | null>` is a `/vue` convenience (S7) — `(await db.getAuth())?.refresh_token`, named in idb's own `refresh_token` vocabulary. It is the one piece of client surface this transport needs; the fetch wrapper around it stays the app's, until a recurring shape earns a shipped helper.

dux does not ship this wrapper yet. The shapes vary too much per client to abstract well before the pattern is proven against the adapters; the spec documents the principle and an example, and a versatile helper earns its place only once a recurring shape is clear.

## 8. Mounting per framework

The utilities carry the same names everywhere; the registration idiom is the framework's. `defineEventHandler` is a general h3 utility — it works standalone, not only in Nitro file routes — and on h3 v2 it is optional, so `/h3` returns bare functions.

```TS
// /h3-v1 — Nuxt 4 / Nitro 2 file routes
export const useServerKit = defineServerKit({ schema, getAppId, getAdminToken })
export default defineAuthSyncHandler({ getAppId }) // server/api/idb.post.ts
export default defineWebhookHandler(handlers) // server/api/webhooks.post.ts
export default defineEventHandler(async (event) => { // server/api/workspaces.get.ts
  const { adminDb, user } = await useServerKit(event, 'user')
  return adminDb.query(/* … */)
})
```

```TS
// /h3 — standalone h3 v2 / Nitro 3 / h3-dux (bootstrap illustrative)
const useServerKit = defineServerKit({ schema, getAppId, getAdminToken })
app.post('/api/idb', defineAuthSyncHandler({ getAppId }))
app.post('/api/webhooks', defineWebhookHandler(handlers))
app.get('/api/workspaces', async (event) => { // h3-dux: event is H3DuxEvent (extends H3Event)
  const { userDb, user } = await useServerKit(event, 'userDb')
  return userDb.query(/* … */)
})
```

```TS
// /hono — e.g. a bearer-only shared backend (api.acme.com)
const useServerKit = defineServerKit({ schema, getAppId, getAdminToken, tokenFrom: 'bearer' })
app.post('/webhooks', defineWebhookHandler(handlers))
app.get('/workspaces', async (c) => {
  const { adminDb, user } = await useServerKit(c, 'user') // throws HTTPException(401) if absent
  return c.json(await adminDb.query(/* … */))
})
```

```TS
// /elysia — note the raw-body opt-in on the webhook route
const useServerKit = defineServerKit({ schema, getAppId, getAdminToken })
new Elysia()
  .get('/workspaces', async (ctx) => {
    const { adminDb, user } = await useServerKit(ctx, 'user')
    return adminDb.query(/* … */)
  })
  .post('/webhooks', defineWebhookHandler(handlers), { parse: 'text' })
```

## 9. Boundary law and file layout

```
src/server/                 # framework-agnostic; no framework peer
  adapter.ts                #   IdbDuxServerAdapter<Ctx> port
  token.ts                  #   IdbServerTokenSource resolution + IdbServerRequestReader
  cookies.ts                #   IdbServerCookieOptions defaults + cookie-name derivation
  serverKit.ts              #   createServerKit — modes, verify+cache, admin memo
  authSync.ts               #   createAuthSyncHandler — cookie write/clear, persistToken
  webhook.ts                #   createWebhookHandler — raw body → /webhooks pipeline
  index.ts
src/h3-v1/  src/h3/  src/hono/  src/elysia/
  adapter.ts                #   the ~9 port ops over this framework's request object
  index.ts                  #   binds the adapter; re-exports the three define* utilities
```

- **`/server` imports** the dux `admin/` and `webhooks/` layers and nothing framework-specific — never `vue`, never `h3`/`hono`/`elysia`, never the official packages directly.
- **Each adapter imports** its one framework + `/server`. It owns no data-plane or verification logic; it is request/response translation only.
- `src/server/webhook.ts` is the *route binding's* core — it consumes `@mszr/idb-dux/webhooks` (verify → fetchPayload → dispatch). It does not reimplement the signature pipeline; `/webhooks` stays the transport-agnostic engine, unchanged.
- **One conformance suite, every adapter.** The request-lifecycle tests run against a real app per framework (driven by web `Request`, asserting the `Response`): one verify per request, mode typing, cookie write/clear, 2xx/4xx mapping, cookie-and-bearer resolution. Parity is asserted, not assumed.

## 10. Naming

Server-plane types stay `Idb`-prefixed and domain-scoped under the `Server`/`AuthSync`/`Webhook` domains; the dux-specific extension point carries the `IdbDux` prefix because "adapter" is a generic term that must say which fork it belongs to.

| Type | What it is |
|---|---|
| `IdbDuxServerAdapter<Ctx>` | the port an adapter implements (the `IdbDux` extension point) |
| `IdbServerKitConfig<S, Ctx>` | `defineServerKit` config |
| `IdbServerKit<Mode, S>` | the mode-narrowed kit |
| `IdbServerKitFactory<S>` | what `defineServerKit` returns |
| `IdbServerKitMode` | `'user?' \| 'user' \| 'userDb?' \| 'userDb'` |
| `IdbServerTokenSource` | the `tokenFrom` union |
| `IdbServerTokenTransport` | `'cookie' \| 'bearer' \| 'cookieOrBearer'` |
| `IdbServerRequestReader` | the cookie/header/appId facade a resolver receives |
| `IdbServerCookieOptions` | cookie attributes |
| `IdbAuthSyncConfig<Ctx>` | `defineAuthSyncHandler` config |

New config fields on this surface: `tokenFrom` (on `defineServerKit`), and `cookieName` / `cookie` / `persistToken` (on `defineAuthSyncHandler`). `apiURI` is kept verbatim — it is idb's own key, not a dux coinage. Values stay unprefixed (`defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler`, `createServerKit`, `createAuthSyncHandler`, `createWebhookHandler`).

## 11. Phased roadmap

### S1 — `/server` core + adapter port ☑

Done when: the three `create*` cores run against a test adapter; request-scoped state works via the adapter's state bag.

- [x] `IdbDuxServerAdapter<Ctx>` port; `IdbServerRequestReader`; `IdbServerCookieOptions`
- [x] `createServerKit` (modes, verify+cache, admin memo), `createAuthSyncHandler`, `createWebhookHandler`
- [x] core suite over a mock adapter (`server/server.test.ts`); the shared parameterized harness (`test-support/serverConformance.ts`) runs every adapter's real lifecycle

### S2 — `/h3-v1` adapter (replaces `/nuxt`) ☑

Done when: the prior `/nuxt` behavior is reproduced on the new core, suite green.

- [x] h3 v1 adapter (the ~9 ops); `defineEventHandler`-wrapped handlers
- [x] `/nuxt` subpath removed; package exports, tsconfig paths, vitest aliases, boundary lint repointed
- [x] real-lifecycle suite (`h3-v1/h3-v1.test.ts`) + mode-narrowing type plane
- [ ] demo retargeted from `/nuxt` to `/h3-v1` (lands with the demo phase)

### S3 — `/h3` adapter (h3 v2 / h3-dux)

Blocked in this workspace: h3 v1 and v2 cannot co-install under one `h3` dep name. Lands when a v2 fixture (alias/separate workspace) is set up; the adapter file itself is ~40 lines over the existing port.

- [ ] h3 v2 adapter — `event.req.text()`, `event.res.status`, bare-function handlers
- [ ] h3-dux verified to ride `/h3` unchanged (`H3DuxEvent` ⊑ `H3Event`)

### S4 — `tokenFrom` transports ☑

- [x] `'cookie'` / `'bearer'` / `'cookieOrBearer'`, the object overrides, the resolver fn
- [x] suite: cookie-only, bearer-only, and mixed requests against one route

### S5 — `/hono` adapter ☑

- [x] Hono adapter; `HTTPException` 401; `c.req.text()` raw body; `WeakMap` state
- [x] runs the shared conformance suite through a real `Hono` app

### S6 — `/elysia` adapter ☑

- [x] Elysia adapter; thrown `status()` 401; `{ parse: 'text' }` webhook mount; reactive-cookie clear via explicit expiry
- [x] runs the shared conformance suite through a real `Elysia` app

### S7 — client bearer-transport pattern

- [x] `db.getCurrentRefreshToken(): Promise<string | null>` shipped in `/vue` (spec'd in [dux-spec-vue.md](./dux-spec-vue.md))
- [ ] end-to-end example (web cookie + shell bearer) in the demo or docs; the principle documented for h3-dux/Hono typed clients
