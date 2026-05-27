# Upstream Follow-Ups

Maintainer tracker for small upstream changes that could remove Vux-specific compatibility layers or reduce local protocol drift.

## Submitted

### First-party route handler protocol

- PR: [instantdb/instant#2706](https://github.com/instantdb/instant/pull/2706)
- Benefit: Custom first-party endpoint handlers can share the same body protocol as Instant's built-in client/server helpers.
- Implementation note: Extracted the route-handler body protocol into a shared helper/type module so client payload creation and server route handling do not duplicate the `sync-user` body shape.

## Candidate

### Readonly-friendly input arrays

- Benefit: Users can author reusable `as const` arrays for fields, `$in` values, `and/or` groups, presence keys, and transaction chunks without losing type safety or fighting mutability-only signatures.
- Current Vux state: `q()/defineQuery` accepts readonly query authoring shapes and normalizes them to the mutable query shape expected by official SDK response types. Vux-controlled query APIs share that path.
- Upstream direction: Official SDK input types could accept `readonly` arrays wherever runtime code only reads the array. This would help direct calls like `adminDb.query(...)` and reduce the need for local Vux normalization.
