# Roadmap

Audience: maintainers planning next delivery slices.

Last updated: `2026-05-10`

## Current state

- Infinite query parity: complete
- SSR mode: resilient fallback shipped, full hydration not shipped
- X API ergonomics: shipped and positioned as first-class usage paths
- Small parity polish pack: shipped (`setInstantWarningsEnabled`, `db.streams`, stream helper type exports)

## Next priorities

1. Permissions DX initiative: typed permission authoring helpers that compile to CEL strings while validating schema paths and rule context at build time
2. SSR adapter MVP for Nuxt-focused server-data hydration path
3. SSR DX pass (boundary guidance, suspense-oriented ergonomics)

## Delivery approach

- Keep each phase independently releasable.
- Prefer additive APIs and clear migration posture.
- Gate each phase with focused tests + demo verification.

## Historical references

For detailed archived analysis, use notes:

- [`notes/feature-parity-audit.md`](./notes/feature-parity-audit.md)
- [`notes/permissions-dx-feasibility.md`](./notes/permissions-dx-feasibility.md)
- [`notes/ssr-feasibility.md`](./notes/ssr-feasibility.md)
- [`notes/misc-feature-feasibility.md`](./notes/misc-feature-feasibility.md)
