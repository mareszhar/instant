# Nuxt and SSR Resilience

Audience: Nuxt users evaluating SSR behavior today.

## Current contract

`@mszr/idb-vux` is currently **SSR-resilient**, not full SSR-hydrated.

That means:

- hooks can execute in server runtime without crashing
- server-side live subscriptions/publishes are not started
- query/auth state resolves through safe inert fallback until client runtime
- `useUser()` defaults to `clientOnly` behavior: throws when missing on client, returns `undefined` on server

## Why this matters

You do not need to force `ssr: false` just to avoid crashes.

At the same time, you should not expect full server query hydration handoff yet.

## Practical guidance

- Client-first UX paths work out of the box.
- For SSR routes, design loading states intentionally.
- Keep class instances out of serialized SSR store payloads.
- Use `createInstantRouteHandler` when you need first-party auth route integration.
- If you prefer stricter auth semantics, set `requireUserInUseUser: 'yes'` in `init`/`defineDb`, or call `useUser({ requireUser: 'yes' })` per call.

## Planned direction

Full SSR query hydration support is on the maintainer roadmap.

Maintainer context:

- `https://github.com/mareszhar/instant/tree/vux/client/packages/vux/docs/roadmap.md`
