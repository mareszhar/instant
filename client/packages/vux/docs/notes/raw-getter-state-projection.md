# Raw Getter State Projection Pattern

Updated: `2026-05-19`

Audience: Vux maintainers working on SDK ergonomics that need no-`.value` reads without making SDK-owned state writable.

## Summary

Vux X APIs expose `state` as a raw getter projection over refs/computed refs.

The user-facing contract lives in [`../../idb-vux/docs/dx-ux-enhancements.md`](../../idb-vux/docs/dx-ux-enhancements.md). Keep usage guidance there and implementation rationale here.

## Why this pattern exists

Pinia setup stores hydrate SSR state by writing serialized server values back into returned refs/reactive objects on the client. That is normal Pinia behavior, but it is a bad fit for SDK-owned readonly projections.

Earlier X `state` surfaces were reactive/readonly objects with getter-like fields. In SSR + Pinia, hydration could try to assign into those getter-only properties:

```ts
store.auth.isLoading = false
```

That can fail at the Vue proxy boundary with an error like:

```txt
'set' on proxy: trap returned falsish for property 'isLoading'
```

## The implementation shape

The source of truth remains normal refs/computed refs:

```ts
const refs = {
  isLoading: computed(() => authState.isLoading),
  user: computed(() => authState.user),
}
```

`state` is a stable plain object with enumerable getter properties:

```ts
const state = markRaw({
  get isLoading() {
    return refs.isLoading.value
  },
  get user() {
    return refs.user.value
  },
})
```

The real implementation builds those properties generically in [`../../idb-vux/src/xResult.ts`](../../idb-vux/src/xResult.ts).

## What `markRaw` does here

`markRaw` tells Vue not to convert the object into a reactive proxy. This matters because:

- Pinia does not treat the raw `state` object as hydratable setup-store state.
- Vue does not try to set through getter-only proxy fields during hydration.
- SDK-owned values stay readonly at the runtime boundary.

## Reactivity model

The `state` object shell is not reactive.

The properties are still reactive when read inside Vue effects because each getter reads an underlying ref:

```ts
watchEffect(() => {
  console.log(auth.state.user?.id)
})
```

That tracks the computed/ref read performed inside the getter. When the underlying ref changes, the effect reruns.

Useful reads:

```ts
watch(() => auth.state.user, onUserChange)
watch(() => auth.state.user?.id, onUserIdChange)
```

Not useful:

```ts
watch(() => auth.state, onAuthStateChange)
```

The raw object reference is stable and the getter is never touched, so there is no dependency to track.

## When to use it

Use this pattern for SDK ergonomics surfaces where all of these are true:

- the SDK owns the actual mutable state
- callers want no-`.value` reads in script code
- callers should not assign into the projected values
- the value may be returned from Pinia setup stores
- SSR resilience matters more than making the projection itself reactive

Avoid it when callers need a writable object, a deeply reactive object shell, or a state object that should be serialized/hydrated by Pinia.
