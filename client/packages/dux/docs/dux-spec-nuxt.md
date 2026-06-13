updated: 2026-06-11
status: spec — contracts are binding; implementation approaches are proposals in their service

# dux spec — `/nuxt`

The h3/nitro/Nuxt server glue: `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler`. Thin by design — it wires the request lifecycle onto `/admin` and `/webhooks`; it owns no data-plane or verification logic of its own.

Conventions: [dux-conventions.md](./dux-conventions.md) · Principles: [dux-vision.md §2](./dux-vision.md#2-design-principles) · Wrapped layers: [dux-spec-admin.md](./dux-spec-admin.md), [dux-spec-webhooks.md](./dux-spec-webhooks.md)

## Implementation status

| Phase | Scope | Global phase | Status |
|---|---|---|---|
| N1 | `defineServerKit` | 7 | ☑ complete |
| N2 | `defineAuthSyncHandler` | 7 | ☑ complete |
| N3 | `defineWebhookHandler` | 7 | ☑ complete |

Details: [§6 Phased implementation roadmap](#6-phased-implementation-roadmap).

- [1. Scope](#1-scope)
- [2. `defineServerKit`](#2-defineserverkit)
- [3. `defineAuthSyncHandler`](#3-defineauthsynchandler)
- [4. `defineWebhookHandler`](#4-definewebhookhandler)
- [5. Implementation approach](#5-implementation-approach)
- [6. Phased implementation roadmap](#6-phased-implementation-roadmap)

---

## 1. Scope

| Utility | Purpose |
|---|---|
| `defineServerKit(config)` | per-request kit: `{ adminDb, user?, … }` depending on mode; request-scoped caching; wraps `/admin` |
| `defineAuthSyncHandler(config)` | the `firstPartyPath` auth-sync route; token-only cookie |
| `defineWebhookHandler(handlers, opts?)` | the one-line webhook route over `/webhooks` |

Peers: `h3` + `@instantdb/admin` + `@instantdb/webhooks`, all optional — only `/nuxt` users pay for them, and only for the parts they use.

## 2. `defineServerKit`

### The contract

Server routes get the same DX the client gets: one factory at module scope, one `await` in the route, typed results — and the route *declares its auth strictness* instead of hand-rolling token reads and verification:

```ts
// server/utils/idb.ts — the request-kit factory
import { defineServerKit } from '@mszr/idb-dux/nuxt'
import { schema } from '~~/config/instant.schema'

export const useServerKit = defineServerKit({
  schema,
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
  getAdminToken: event => useRuntimeConfig(event).instantAppAdminToken,
})
// /nuxt wraps /admin, which owns @instantdb/admin — no init injection
```

```ts
// In a Nuxt server route — the kit's keys vary by mode
const { adminDb, user } = await useServerKit(event, 'user?')

const { workspaces } = await adminDb.query(q({
  workspaces: {
    $: { where: { 'memberships.user': user?.id ?? $skip } },
    memberships: {},
  },
}))
// workspaces: Workspace[] — the data plane is /admin's, shaping and all
```

Binding behaviors:

- **The kit's keys vary by mode, typed accordingly.** Strictness is declared at the call site and the types follow — no manual narrowing, no repeated 401 boilerplate.
- **Request-scoped caching.** Repeated `useServerKit(event, …)` calls in one request reuse already-computed values — the auth-token read and the verification promise are cached on the event context (principle 8: per-event work happens once).
- **Lazy config.** `getAppId`/`getAdminToken` receive the event, so runtime config resolution works without module-load-time values.

### Modes (proposal)

| Mode | Kit | Behavior |
|---|---|---|
| *(none)* | `{ adminDb }` | no auth work performed |
| `'user?'` | `{ adminDb, user: IdbAuthUser \| undefined }` | reads + verifies the auth cookie if present |
| `'user'` | `{ adminDb, user: IdbAuthUser }` | missing/invalid auth → throws the h3 401 error |
| `'userDb?'` / `'userDb'` | adds `userDb` — `adminDb.asUser({ token })`-scoped | per-request permission-scoped db, same optional/required split |

## 3. `defineAuthSyncHandler`

### The contract

The route handler for Instant's `firstPartyPath` auth sync — one line to mount:

```ts
// server/api/idb/[...].ts
export default defineAuthSyncHandler({
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
})
```

**Intentional cookie divergence:** the official route handler stores the full user JSON in `instant_user_<appId>`. dux's handler stores only the `refresh_token` in `instant_token_<appId>` — a smaller cookie and less user data on the wire; the server kit re-derives the user from the token when a mode asks for it. `createInstantRouteHandler` remains re-exported for apps that want the official shape (and official `getUserFromRequest` compatibility, [dux-spec-admin.md §5](./dux-spec-admin.md#5-asuser-and-the-pass-throughs)).

Writes and clears the cookie per the official sync protocol; SameSite/secure defaults follow the official handler.

## 4. `defineWebhookHandler`

### The contract

A webhook route is one line, with official retry semantics intact:

```ts
// server/api/webhooks.post.ts
export default defineWebhookHandler(handlers)
```

- Reads the raw body the h3 way (signature verification requires the exact bytes), delegates verify → fetch → dispatch to `/webhooks`, and answers 2xx/4xx per official retry semantics (handler rejection → non-2xx → Instant retries).
- The singular/plural pair is deliberate grammar: `defineWebhookHandlers` (in `/webhooks`) authors the *many* handlers; `defineWebhookHandler` is the *one* route handler that receives them — `defineWebhookHandler(defineWebhookHandlers({ … }))` reads as exactly what it does.

## 5. Implementation approach

A proposal — details may move in service of the contracts above.

```
src/nuxt/
  defineServerKit.ts        # request-scoped kit; event.context caching; composes /admin
  defineAuthSyncHandler.ts  # firstPartyPath sync; token-only cookie
  defineWebhookHandler.ts   # h3 raw body → /webhooks process
  index.ts
```

- `event.context` keys are namespaced (`event.context.idbDux*`) and cache: the parsed token, the verify promise (so concurrent kit calls share one verification), and the per-request `userDb`.
- The kit factory builds the `/admin` db once per process (memoized like `defineDb`) — only the *user* work is per-request.
- Boundary law: `nuxt/` imports `h3` + the dux `admin/` and `webhooks/` layers — never `vue`, never the official packages directly.

---

## 6. Phased implementation roadmap

### Phase N1 — `defineServerKit` (global phase 7)

Done when: kit modes typed + verified end-to-end in runtime tests.

- [x] kit factory: lazy config, memoized admin db, event-context caching
- [x] modes: none / `'user?'` / `'user'` (+ `userDb` variants) with mode-narrowed kit types
- [x] 401 behavior for `'user'` without valid auth
- [x] runtime suite: caching (one verify per request), mode typing, concurrent calls
- [x] `.test-d.ts`: kit key narrowing per mode

### Phase N2 — `defineAuthSyncHandler` (global phase 7)

- [x] the sync route: write/clear token-only cookie per the official protocol
- [x] cookie attributes parity (SameSite/secure/path) with the official handler
- [x] `createInstantRouteHandler` re-export for the official shape
- [x] runtime suite: sync flow (token-only cookie, app-id/type guards)

### Phase N3 — `defineWebhookHandler` (global phase 7)

- [x] raw-body read the h3 way; delegate to `/webhooks` verify → fetch → dispatch
- [x] 2xx/4xx mapping per official retry semantics
- [x] runtime suite: end-to-end route test on shared webhook fixtures
