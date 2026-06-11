# Reviewer brief — final review of the dux blueprint before spec generation

**What you're reviewing:** `dux-a-blueprint-with-foresight.md` (the authority), with `ideal-vux.md` and `ideal-perms-spec-x.md` as the converged feature/perms specs. The blueprint declares itself complete — "No open questions remain" (§13), "Convergence is complete" (§16). **Treat that as a claim to test, not a premise.** Your job is the last gate before these become granular specs and a doc plan; if the scope or foundations need to move, this is the moment.

## Part A — The lens to read everything through

The blueprint is excellent *within the frame it inherited*. That frame was set by accident of history: this began as a refactor of a Vue wrapper (`idb-vux`), and its scope — core + vue + nuxt + admin + perms — is the scope a Vue wrapper would naturally grow into. The vision was later re-derived ("dux is a reimagining of idb, not a Vue wrapper" — §1), but **the scope was never re-derived to match the new vision.**

So please read the whole thing against one question, the same one `ideal-vux.md §2.1` puts at the center: **what does the most delightful idb look like?** — and specifically:

- If you had *no* prior investment in the existing surfaces, and you were asked "what is the complete set of things a delightful idb developer experience must cover," would you arrive at the blueprint's five entrypoints? Or would you draw the boundary somewhere else?
- Where the blueprint says "same as official" (e.g. `db.storage.*`, `db.auth.*`, `db.streams` in `ideal-vux §5.1`), is that a *considered* pass-through decision, or an un-examined inheritance? A pass-through is fine — but it should be a decision dux made, not a thing dux never looked at.

The rest of this brief is the concrete application of that lens.

## Part B — The undefined scope boundary (the core issue)

InstantDB's surface that is *framework-agnostic* — dux's claimed home turf, the "agnostic plane" it says it exists to make excellent (§1.1) — is larger than the blueprint treats. Two official, framework-agnostic SDKs sit squarely in that plane and appear **nowhere** in the proposal corpus:

### B1. Webhooks (`@instantdb/webhooks`)

This is the *easy, high-value* case and a near-perfect fit. The webhook payload types are already schema-aware via per-call generics (`WebhookEntity<Schema, NS>`, `WebhookPayloadRecord<Schema>`, `WebhookHandlers<Schema>`) — exactly the repetition dux's schema registration (§11.3) was invented to eliminate. A dux-flavored webhooks surface would naturally yield `IdbWebhookPayload<'ns'>`, `IdbWebhookEntity<'ns'>` that are *consistent with* `IdbEntity<'ns'>` and bind to the registered schema for free.

- Should dux ship a `/webhooks` (or fold webhook handling into `/admin` / `/nuxt`, since `WebhooksManager` is token/admin-scoped)?
- The webhook payload's `before`/`after` entity shapes — should they reuse the *same* `shapeResult`/entity-typing machinery as queries (§7), so a webhook handler and a query reading the same namespace see identically-shaped, identically-named records? That single-mental-model consistency is precisely dux's value proposition.
- If yes, this is a small surface with an outsized payoff for "one garden, one model." Confirm or rule it out — don't leave it unmentioned.

### B2. Platform (`@instantdb/platform`) — the harder, more consequential case

The platform SDK manages apps/schemas/perms *programmatically*: `PlatformApi` (createApp, schemaPush, planSchemaPush, pushPerms, getSchema/getPerms), `OAuthHandler`, schema/perms **codegen**, and schema **migration/diff** tooling (`diffSchemas`, `buildAutoRenameSelector`). It is not niche — Instant's own `cli`, `mcp`, `create-instant-app`, and dashboard `components` all depend on it.

The hard question is not just "should dux wrap it" but **"is the platform SDK's world even compatible with dux's central architectural bet?"** Three specific tensions to adjudicate:

1. **Single-schema vs. many-dynamic-schemas.** dux's spine is "one schema, registered once as the source of truth" (`IdbRegister`, §11.3). The platform SDK's whole premise is the opposite: *N* apps, schemas fetched at runtime, generated as `.ts`, diffed, migrated. A platform tool (a CMS builder, a migration runner, a dashboard) has *no* single registered schema. Does the registration model degrade gracefully here, or does dux need an explicit per-instance / dynamic-schema mode for this surface? Is "single registered schema" and "the platform API" ever a realistic *combined* use case, or are they disjoint audiences — and if disjoint, does that argue for or against dux even entering this space?

2. **Codegen target.** `generateSchemaTypescriptFile(null, schema, '@instantdb/react')` literally emits an `instant.schema.ts` string targeting a named package, using `i.entity`. For a dux user this should emit `defineSchema` / `i.namespace` against `@mszr/idb-dux`. Is "dux-flavored schema/perms codegen" the *actual* headline feature here (more than wrapping the HTTP calls)? And does dux's richer schema — `singular`, `ruleParams`, `options` (`ideal-vux §3`) — even survive a round-trip through the platform API, which only speaks the backend's metadata-free shape? If a dux schema is pushed and later pulled/regenerated, is the dux-specific metadata silently lost? That's a correctness concern, not just an ergonomics one.

3. **Migrations.** `diffSchemas` + the rename-selector machinery is a genuinely delightful capability no client SDK surfaces. Does "what does the most delightful idb look like?" demand a dux take on schema migration — and if so, does dux's schema-as-source-of-truth model make that *better* than the official one, or does it complicate it?

### B3. Finish the sweep — rule each surface in or out, explicitly

So the omission is a decision and not an oversight, please give a one-line in/out verdict (with reason) for each remaining agnostic or near-agnostic surface, not just the two above:

- **Storage** (`db.storage.*`) — agnostic; currently "same as official." Dux-flavor or deliberate pass-through?
- **Auth flows** (magic codes, OAuth, `db.auth.*`) — partly agnostic; same question.
- **Streams / `resumable-stream`** — `@instantdb/resumable-stream` is admin-backed and framework-agnostic; in or out?
- **CLI codegen interplay** — dux changes what `instant.schema.ts` / `instant.perms.ts` look like. Does the official `instant-cli` push/pull still round-trip a dux schema file? Is there a CLI-adjacent obligation dux is implicitly taking on?
- **MCP** — out of scope to build, but worth a sentence: does a dux schema/perms file remain legible to the official MCP server?

## Part C — Architectural stress-tests the gap exposes

Even if some of B lands out of scope, these foundational questions are surfaced *by* the gap and matter regardless:

- **C1 — The plane taxonomy has only two slots.** §5.1's dependency graph and §5.2's boundary lint know two categories: framework-agnostic, and framework-coupled-client. Platform and webhooks are a *third* shape — server-side, auth/token-scoped, not a reactive binding and not pure authoring. Where do they live in the graph? Does the boundary-lint model (§5.2) have a row for "server-agnostic surface that may import `@instantdb/platform` but never `vue`/`h3`"? If the taxonomy can't express them, the taxonomy — not the surfaces — may be what's incomplete.

- **C2 — Naming contract scale-test.** The naming contract (§11) was derived against query/tx/perms/auth/room/storage/admin domains. Does it extend cleanly to `IdbPlatform*`, `IdbWebhook*`, `IdbMigration*`? And resolve the concrete collision: dux redefines `i` to carry `i.namespace`, while `@instantdb/platform` re-exports core's `i` with `i.entity`. A user mixing dux + platform imports the same name `i` with two different shapes. The §10.1 collision policy ("standalone exports sit behind the dux specifier") assumes the user isn't *also* importing the official one — which is exactly what a platform user does. Does that policy hold here, or does it need a clause?

- **C3 — Drift discipline widens.** The baseline-drift check (§6.3) and fork-rebase ritual currently watch only `client/packages/vue`. Every agnostic surface dux adopts (webhooks especially, since its types track the schema shape) widens the vendor/track surface. Is the "vendor-and-mark + drift-check" model (which was designed for *one* reactive client) the right tool for these, or do they want a different sustainability treatment (e.g. thin re-export + rename layer rather than full vendoring)?

## Part D — Whichever way it lands, make it a stated decision

The blueprint's biggest gap right now isn't that platform/webhooks are missing — it's that their absence is **undocumented**, so a reader can't tell whether they were *considered and excluded* or simply *never seen*. Please drive to one of two explicit outcomes:

- **In scope (any subset):** the doc plan (§14) gains the corresponding `dux-spec-*.md`, the roadmap (§12) gains phases, and the recurring "five entrypoints" framing (§3, §12) is updated. Sequence matters — webhooks is small and schema-adjacent (could slot right after the query/schema layer); platform is large and arguably its own track.
- **Out of scope (any subset):** the blueprint adds a short, *defended* "Out of scope (for now)" section naming platform/webhooks/etc. with the reason and the trigger that would bring them in — mirroring how it already handles deferred SSR hydration (`ideal-vux §11`). And §13/§16 are softened: "no open questions remain" cannot stand while the scope boundary is undrawn.

**The meta-point for the reviewer:** the value of this pass is less "should dux do platform/webhooks" and more "**dux has never explicitly defined the edge of its own ambition.**" Wherever you draw that edge, draw it on purpose, and write down why.

---

Want me to drop this into `client/packages/vux/docs/notes/` as a note (e.g. `dux-reviewer-brief.md`) so it lives alongside the proposal, or keep it as something you hand off separately?
