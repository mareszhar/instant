# Testing Strategy

Audience: maintainers validating behavior and release safety.

## Scope

Tests cover parity-oriented behavior, Vue lifecycle correctness, and SSR-resilient safety.

## Behavioral invariants

- Query hooks never subscribe when query is `null`.
- Function queries re-subscribe and cleanup on reactive input change.
- Cached query/auth snapshots bootstrap before first subscription updates.
- Infinite query semantics match core expectations (`canLoadNextPage`, `loadNextPage`, query-change reset).
- Presence/topic subscriptions bind to scope cleanup.
- Typing indicator cleanup handles timeout/null/zero rules correctly.
- Cursor customization precedence is deterministic: slot > `renderCursor` > default.
- Server runtime paths remain inert (no subscribe/publish side effects).

## Suites

- `src/tests/InstantVuxDatabase.test.ts`
- `src/tests/InstantVuxInfiniteQuery.test.ts`
- `src/tests/InstantVuxRoom.test.ts`
- `src/tests/Components.test.ts`
- type-contract suites under `src/tests/*.types.ts`

## Acceptance checks

From `client/packages/vux`:

1. `pnpm run sdk:lint`
2. `pnpm run sdk:typecheck`
3. `pnpm run sdk:test`
4. `pnpm run sdk:build`
