updated: 2026-04-24
status: completed

# Instant Vux Demo Patterns Notes

This ledger tracks experiments for making the Vux demo feel both realistic and simple. The goal is to keep the public demo feature-complete while discovering patterns that make InstantDB look as direct as it feels in a polished app.

## Experiment 1: Todo Query Pattern Lab

Status: implemented as a sandbox at `/patterns`; manual testing found the first winner and prompted a second matrix pass to isolate which dimension causes jitter.

Patterns in the lab:

- SPLS, Scope preloads + local status: keep one subscription for all todos and one for mine, cache the latest result for each, and filter `active`/`done` locally.
- SQUS, Single query with direct `undefined` skip: use one reactive query with `where: { 'owner.id': maybeUserId, done: maybeDone }`, letting core remove direct `undefined` keys before subscribing.
- SQK, Single query with `keepPreviousData`: same query shape, plus a Vux-only option that keeps the previous result visible while a new query has no cached result.
- ASQLS, Active scope query + local status: subscribe only to the current all/mine scope, but still filter `active`/`done` locally.
- NMLS, No-mine + local status: ignore ownership and filter `active`/`done` locally from the all query.
- NMQS, No-mine + query status: ignore ownership, but switch `active`/`done` by changing the query-level `done` filter.

Findings:

- Native InstantDB/core parity: `coerceQuery` removes direct `undefined` values by JSON round-tripping the query before hashing/subscribing. This supports the clean "undefined means skip this direct condition" pattern at runtime.

- Native pattern caveat: skip the whole operator object, not an operator value.
  - Prefer `ownerId: ids.length ? { $in: ids } : undefined`
  - Avoid `ownerId: { $in: maybeIds }`

- Vux-package-exclusive addition: `useQuery(..., { keepPreviousData: true })` retains the current data between reactive query changes only when no cached result exists for the next query yet.

- Manual result, 2026-04-24: only the scope-preload/local-status pattern was free of visible jitter. The single-query `undefined` skip and single-query `keepPreviousData` variants behaved the same in practice: both worked, but both had a short shake while switching filters.

- Working hypothesis: the jitter is triggered by changing the subscribed query for a high-frequency tab, not by `undefined` itself and probably not by the `mine` dimension specifically. When a query changes, Vue `useQuery` rebinds the subscription, checks the reactor cache for the new query hash, and then updates when the subscription result arrives. Even if this is fast, the DOM sees an async data boundary. `keepPreviousData` can keep old rows visible during that boundary, but it cannot make the new filtered rows appear in the same synchronous turn as the button click.

- Interpretation: `keepPreviousData` prevents empty/loading flashes, but it cannot make a changed query resolve synchronously. For high-frequency UI tabs like `active`/`done`, the smooth pattern is to project locally from already subscribed data. Query-level filters still make sense for realistic scope and permission boundaries such as `mine`.

- New matrix to test:
  - If "no-mine + query status" jitters, the mine dimension is not required to reproduce the problem.
  - If "no-mine + local status" is smooth, local projection is sufficient when all relevant rows are already subscribed.
  - If "active scope query + local status" is smooth for active/done but not all/mine, scope preloads are specifically what remove scope-switch jitter.

- Manual matrix result, 2026-04-24:

  | Pattern | all/mine row | status row while scope = all |
  | --- | --- | --- |
  | SPLS | no jitter | no jitter |
  | SQUS | jitter | jitter |
  | ASQLS | jitter | no jitter |
  | NMLS | no jitter | no jitter |
  | NMQS | no jitter | jitter |
  | SQK | no jitter | jitter |

- What this proves:
  - Local status projection is the reliable fix for status-tab jitter. SPLS, ASQLS, and NMLS are all smooth for status switches because `active`/`done` do not change their subscribed query.
  - Query-level status filters jitter even without `mine`. NMQS jitters on status switches, so the ownership dimension is not required to reproduce the issue.
  - Scope switches need either preloaded scope queries or some stale-data masking. SPLS is smooth because both all and mine are already subscribed. ASQLS jitters because all/mine changes the active subscribed query. SQK did not visibly jitter on all/mine in this test, likely because `keepPreviousData` masks the query rebind by holding old rows until the new scope resolves; that is useful, but it may briefly show stale scope data and still does not solve status-tab jitter.

- Current direction: keep the public demo behavior equivalent to scope preloads plus local status filtering, then reduce the ceremony with a small helper or store slice instead of forcing a single-query shape.

## Experiment 2: Scope-Preload Helper

Status: implemented in the demo as `usePreloadedQueryScopes`.

Purpose:

- Keep the SPLS UX contract while removing repeated cache/resolved bookkeeping.
- Model the generally useful pattern as named query scopes plus local projection, not as todo-specific all/mine logic.

Shape:

- Call `useQuery` once per scope the UI needs to switch instantly between.
- Pass those query states to `usePreloadedQueryScopes`.
- Read the active scope through `items`, or a specific scope through `itemsFor`.
- Apply fast view filters locally with `computed`, e.g. active/done, tabs, chips, or client-only sort/group controls.

Current use:

- `/patterns` SPLS now uses the helper.
- The public todo store now uses the helper for public/mine scope data.

Open question:

- This is currently a demo composable, not an SDK export. It should only move into `@mszr/idb-vux` if another realistic feature needs the same abstraction and the API still feels broadly reusable.

## Follow-up Checklist

- Refactor the public todo store around the winning pattern without changing UX.
- Manually retest SPLS and the public todos panel after the helper extraction.
- Manually test the new matrix panels and record which transitions jitter: status switches, scope switches, signed-out mine, and sign-in/sign-out.
- Verify sign-in/sign-out transitions do not leak stale "mine" todos.
- Keep `keepPreviousData` documented as useful for non-tab transitions, but do not use it as the todo tab solution unless a later experiment proves otherwise.
