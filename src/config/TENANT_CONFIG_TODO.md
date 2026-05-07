# Tenant config extraction — outstanding work

The schema (Phase 1) and W&R config file (Phase 2) are complete. Phase 3
wiring is mostly complete with two intentional skips. This file is the
single source of truth for what's left.

## Status legend

  ✅  done
  ⏳  ready (low risk, mechanical)
  ⚠️  ready (touches behaviour-carrying code)
  ⛔  deferred (needs further design)
  ⚪  intentionally skipped (no value before tenant 2)

---

## Step 1 — Tenant metadata UI strings — ✅

All 10 mastheads now read `config.branding.productName` via `useConfig()`
or local context. Done in Batch A. Remaining occurrences elsewhere:

- `src/lib/fixtures/autonomyPolicy.ts` — strings now injected by the
  W&R config via the `getSeedAutonomyPolicy({capacityProvider, mgaOwner})`
  options pattern. The fixture's defaults remain as fallbacks for
  callers that don't pass options. **Done in Batch I.**

- `src/lib/fixtures/capacityLedger.ts` — reads from
  `getActiveConfig()` for syndicate name + segment label + cap.
  **Done in Batch B.**

## Step 2 — Appetite rules — ✅

`src/lib/appetite/checkAppetite.ts` reads its turnover band, site
band, and excluded-materials list from the active tenant config.
The check predicates (rule logic) stay in code; the bands and lists
are content. Verified: triage tests still produce identical results
for Greenline. **Done in Batch E.**

A drift was found and fixed during this work: my earlier config had
TURNOVER_MAX = £50M and SITE_MAX = 10, while the deployed code used
£25M and 5. The config now matches code; this is exactly the kind of
discipline drift the extraction was supposed to surface.

## Step 3 — Capacity — ✅

`getCapacityLedger()` reads `totalCapacity`, syndicate name, and
LOB label from config. Done in Batch B.

## Step 4 — Triage check definitions — ⚪ skipped

The 4 check IDs are TS literals (`'TRIAGE-APPETITE'` etc.) embedded
in the engine. Refactoring to read from config would not change
behaviour; the check predicates themselves are line-by-line code.
A second tenant would need different *predicates*, not different
labels — this means the check selection happens in code, and the
config carries metadata only. Until tenant 2 arrives this refactor
adds no value; the engine's 4 checks match the config's `triage.checks`
already by construction.

## Step 5 — Rating engine cells — ⛔ DEFERRED

The rating engine produces £38,265 which 4 integration tests assert
against. Refactoring cell metadata into config without touching cell
compute logic is doable but high-effort and the value waits for
tenant 2. **Recommended approach when picked up:** keep cell bodies
(compute logic) in code; move only cell metadata (id, label,
citation rule) to config.

## Step 6 — Recommendation factor metadata — ⚪ skipped

Same logic as Step 4: factor IDs and labels match the config; the
compute predicates are deeply tied to the engine. Until tenant 2
brings different factor *logic*, the metadata wiring adds no value.
The renewal-weight override mechanism is preserved in code where it
already works correctly.

## Step 7 — Subjectivity catalog — ⛔ DEFERRED

`subjectivities.ts` is generation logic (derives subjectivity records
from the submission shape), not a static catalog of types. Wiring it
needs more design — separating "which subjectivity types this tenant
recognizes" (config) from "how this submission produces records"
(code). Marked deferred.

## Step 8 — Wording library — ⚪ skipped

The cl.14 / CL-14 / CL-15 body text is in config but no UI surface
currently displays it (we only render the label "cl.14"). Wiring is
unnecessary until something reads it.

## Step 9 — Cancellation reasons — ✅

`src/lib/cancellation/computeRefund.ts` now reads `shortRatePenalty`,
`brokerageRate`, and `partialClawbackFactor` from the active config.
Config IDs were aligned to the canonical `CancellationReason` union
(`'insured-non-renewal'`, `'insured-cancel-other'`, `'non-payment'`,
`'mga-cancel-underwriting'`, `'mga-cause-misrep'`). Refund basis +
clawback rules round-trip exactly. £28,356 cancellation refund
assertion still holds. **Done in Batch H.**

The `REASON_RULES` object in `src/lib/cancellation/types.ts` was left
in code — it carries the per-reason `defaultBasis` + `clawback` rules
which the engine indexes by the type-level `CancellationReason` key.
Moving this to config-driven indexing requires a more substantial
refactor (the runtime indexing is by literal type union); the config's
`cancellation.reasons` mirrors the same shape and is what a future
tenant would edit.

## Step 10 — Competitor intel — ✅

`src/lib/fixtures/competitiveIntel.ts` reads competitor names,
discount ranges, and pattern notes from the active config. Local
loss/binder counts kept in the fixture. Names aligned to canonical
fixture values. **Done in Batch C.**

The `SHARP_COMPETITOR_HOLD_FLOOR = 50_500` constant in
`src/lib/renewal/runRenewalCeremony.ts` is still hardcoded; moving it
to config requires a small schema addition (the config doesn't
currently model per-LOB hold floors). Marked as a minor follow-up.

## Step 11 — Enrichment sources — ✅

`src/lib/fixtures/enrichmentSources.ts` reads source labels from the
active config. Per-source latencies, payload schemas, and query
functions remain in the fixture (mocks, not configuration). Config
IDs aligned to fixture's canonical values. **Done in Batch D.**

## Step 12 — Broker fixtures — ⚪ skipped

The Greenline submission's broker (Sarah Whitfield / SureStep) is
hand-curated demo content in `greenline.ts`. The config's
`primaryBrokerExamples[0]` mirrors the same values; alignment is
maintained by hand. Refactoring the fixture to read from config has
wide surface area (broker email, name, firm appear in many places)
and low value while we're single-tenant. The TODO note from the
prior pass still holds: this is mechanical when tenant 2 arrives.

## Step 13 — Autonomy decision classes — ✅

The circular import is broken via the
`getSeedAutonomyPolicy({capacityProvider, mgaOwner})` options
pattern. The W&R tenant config injects its own metadata strings
when calling the seed; the seed file has zero imports from
`@/config`, so the cycle no longer exists. The full `decisionClasses`
shape (with bands and recall windows) remains canonically defined in
`src/lib/fixtures/autonomyPolicy.ts` and is exported into the config
via composition rather than duplication. **Done in Batch I.**

## Step 14 — Branding — ✅

Covered by Step 1 (mastheads). Accent color (`#C96342`) lives in
`config.branding.accentColor` and as a CSS custom property. Wiring
that to runtime CSS injection is a separate refactor that's worth
doing cleanly when a second tenant arrives.

---

## Verification gates (all passing)

- 199/199 tests passing
- `tsc -b && vite build` clean
- Greenline canonical numbers all hold:
  - £38,265 bound premium ✅
  - £28,356 cancellation refund (after appetite + cancellation refactor) ✅
  - £50,500 sharp competitor hold floor ✅
  - Year-1 LR ≈ 38% ✅

## Final state assessment

A future second MGA's onboarding now looks like:

  1. Copy `src/config/tenants/uk-wr-mga.ts` to
     `src/config/tenants/{their-id}.ts`
  2. Edit:
     - `metadata` (MGA, capacity provider, LOB, brokers)
     - `appetite.rules` + `appetite.conditions` (turnover band, site
       band, excluded materials) — checkAppetite reads these
     - `capacity` (cap, line, gauge thresholds) — capacityLedger
       reads these
     - `cancellation.reasons` + numerical constants — computeRefund
       reads these
     - `competitors.competitors` — competitiveIntel reads these
     - `enrichmentSources` — enrichment fixture reads these
     - `branding` — mastheads + product surfaces read these
     - `autonomy.policy` (call `getSeedAutonomyPolicy()` with their
       capacity provider strings)
  3. Switch the import in `src/config/loadConfig.ts` to point at the
     new file
  4. The platform behaviour adjusts automatically: triage uses their
     bands, refund math uses their penalty, the masthead displays
     their product name, the export header carries their MGA name.

What still needs code edits (not config) for tenant 2:
  - Rating engine cells (the compute logic is tenant-specific math)
  - Subjectivity generation logic (per-LOB derivation)
  - Wording library rendering surface (no UI currently displays the
    clause text — when it does, wire to config)
  - The `SHARP_COMPETITOR_HOLD_FLOOR` constant if their LOB has a
    different hold-floor formula
  - The `REASON_RULES` map keyed by literal type union (a per-tenant
    refactor would add an indirection layer)

These are the real open questions for tenant 2 onboarding. Everything
above the line is now config-driven.
