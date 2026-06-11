**Reviewer Request Brief**

Please review the dux proposal as a completeness and long-term-stability review, not just a polish pass. The north-star question is:

> If we were designing the most delightful InstantDB experience from first principles, with no `idb-vux` refactor bias, what would the ideal dux surface be?

Primary inputs:

- [dux blueprint](/Users/mares/Base/Projects/Practice/instant/client/packages/vux/docs/notes/dux-a-blueprint-with-foresight.md)
- [ideal dux feature spec](/Users/mares/Base/Projects/Practice/instant/client/packages/vux/docs/notes/ideal-vux.md)
- [perms spec](/Users/mares/Base/Projects/Practice/instant/client/packages/vux/docs/notes/ideal-perms-spec-x.md)

Please especially challenge the current claim that “no open questions remain.”

**1. Scope Audit**
Please inventory the official Instant package surface and classify each as:

- covered by current dux proposal,
- intentionally out of scope,
- compatibility target only,
- or probably deserving a dux-flavored subpath/spec.

The obvious uncertain packages are `@instantdb/platform` and `@instantdb/webhooks`. Framework packages like React/Svelte/Solid/RN can stay reference-only for now, since dux is first-class only for Vue/Nuxt initially. But framework-agnostic SDKs deserve explicit treatment.

Also check whether `instant-cli`, `@instantdb/mcp`, and `create-instant-app` should be compatibility targets in the docs plan, even if not dux subpaths.

**2. Platform SDK Question**
The current proposal does not say what “ideal dux” means for `@instantdb/platform`, but platform seems central to app/schema/perms management.

Please answer:

- Should dux ship `@mszr/idb-dux/platform`, or explicitly defer it?
- If deferred, does the official platform SDK already work cleanly with dux `defineSchema` and `definePerms().compile()` outputs?
- Does the platform SDK’s app/schema/perms lifecycle fit dux’s naming, type, and DX principles?
- How should dux handle `createApp`, `createTemporaryApp`, `planSchemaPush`, `schemaPush`, `pushPerms`, `getSchema`, and `getPerms`?
- Should dux provide dux-style generators/parsers for `instant.schema.ts` and `instant.perms.ts`? Official platform currently generates `i.schema(...)` / `InstantRules` code, while dux wants `defineSchema`, `i.namespace`, `ruleParams`, `singular`, schema options, and module augmentation.
- What happens on platform pull/push round trips? Backend schema cannot preserve dux-only metadata like `singular`, `ruleParams`, or `options`. Is that acceptable, or does dux need a sidecar, conventions, or generator strategy?
- Is the `IdbRegister` global schema pattern compatible with platform-style dynamic/multi-app/multi-schema usage, or does platform need an explicit-schema-only story?

**3. Webhooks Question**
The official webhooks package is standalone and also re-exported through admin and platform. That makes it more than a side surface.

Please answer:

- Should dux ship `@mszr/idb-dux/webhooks`, or should webhooks only be exposed through `/admin`, `/platform`, and `/nuxt`?
- Should `adminDb.webhooks` and `platformApi.webhooks(appId)` return a dux-flavored webhooks object if those parent surfaces are dux-flavored?
- Do official webhook types and helper names fit the dux naming contract, or should types become `IdbWebhook*`?
- Is the current official handler DX already delightful enough, or should dux provide helpers like `defineWebhookHandlers`, schema-registered `typedHandlers`, or Nuxt/H3 request handlers?
- For webhook payload records, should dux expose field-only entities, `IdbEntity`, or some new webhook-specific entity type?
- Where should raw-body/signature handling for Nuxt live: `/nuxt`, `/webhooks`, or both?

**4. Admin Completeness**
The current `/admin` proposal focuses on shaped `query` and typed `tx`, but official admin also includes auth, storage, streams, rooms, webhooks, subscriptions, impersonation, debug query/transact, and route helpers.

Please review whether “same as official” is good enough for these, or whether the ideal dux should wrap/rename/type any of them for consistency.

Specific questions:

- Should `debugQuery` / `debugTransact` understand `definePerms().compile()` and typed `ruleParams`?
- Should `asUser`, auth helpers, storage, streams, and rooms participate in the dux result/naming/type conventions?
- Should admin subscriptions share the same `shapeResult` semantics as Vue and one-shot admin queries?

**5. Architecture Stability**
If platform/webhooks/admin get dux overlays, please check whether the architecture still holds.

- Does “vendored baseline + additive overlay” apply only to Vue, or to admin/platform/webhooks too?
- If not vendored, what keeps upstream drift visible?
- Should drift/parity checks exist for admin, platform, and webhooks, not only Vue?
- What should the dependency graph become if `/platform` and `/webhooks` exist?
- Would new subpaths force the package split earlier than the blueprint expects?
- Do optional peer dependencies still work cleanly?

**6. Docs Plan Update**
Please recommend whether the docs plan should add:

- `dux-spec-platform.md`
- `dux-spec-webhooks.md`
- a broader `dux-spec-tooling-compat.md`
- or an explicit “out of scope / compatibility matrix” section.

The final output should include:

- a recommended public subpath map,
- a compatibility matrix against official packages,
- blocking decisions before granular specs are written,
- proposed edits to the blueprint/docs plan,
- and any “this sounds delightful, but will rot later” risks.
