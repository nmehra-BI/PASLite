# Tenant config extraction — outstanding work

The schema (Phase 1) and W&R config file (Phase 2) are complete. Phase 3
wiring is partial: low-risk display surfaces are wired; the deeper
behaviour-carrying integrations are documented here for the next pass.

This file is the single source of truth for what's left. Each entry lists
the call sites, the config field they should read from, and the risk
level. Work through them in order; each step has an explicit verification
gate (the Greenline E2E test must still pass).

## Status legend

  ✅  done
  ⏳  documented + ready (low risk, mechanical)
  ⚠️  documented + ready (touches behaviour-carrying code)
  ⛔  deferred (needs further design before extraction)

---

## Step 1 — Tenant metadata UI strings — ✅ partial / ⏳ remaining

**Done:** QuoteSlip capacity line + signature, MtaCeremony capacity hash,
MtaScheduleSection signature block, RenewalCeremony capacity hash,
CancellationWorkflow signed-by line, ExportModal recipient labels,
ExportPreview send-to-capacity recipient.

**Remaining:**

- 10 mastheads still display the literal "RanBerri" product name. Files:
  - `src/features/listing/ListingPage.tsx:119`
  - `src/features/autonomy/AutonomyPolicyAdmin.tsx:234`
  - `src/features/autonomy/ExceptionQueuePage.tsx:529`
  - `src/features/lifecycle/Masthead.tsx:31`
  - `src/features/lifecycle/TopBar.tsx:72`
  - `src/features/quote/QuoteSlip.tsx:131`
  - `src/features/postbind/BoundCertificate.tsx:112`
  - `src/features/mta/MtaScheduleSection.tsx:94`
  - `src/features/ledger/LedgerPage.tsx:114`
  - `src/features/ledger/LedgerSectionDetail.tsx:214`
  Each needs `useConfig()` and replace the string with `config.branding.productName`. Risk: cosmetic only.

- `src/lib/fixtures/autonomyPolicy.ts:16-17` hardcodes the policy's
  `approvedBy.capacityProvider` and `mgaOwner` strings. The autonomy policy
  is loaded into `useAutonomy.policy` and rendered in `AutonomyPolicyAdmin`.
  Read from `config.metadata.capacityProvider.name` and `config.metadata.mgaName`.
  Risk: low — the audit events that reference the policy version are
  unaffected.

- `src/lib/fixtures/capacityLedger.ts:22-23` hardcodes `'Syndicate 2358'`
  and `'UK W&R · Tier-2'`. Read from `config.metadata.capacityProvider.name`
  and a derived `${lob.label} · ${lob.tier}` label.

## Step 2 — Appetite rules — ⚠️

**Where:** `src/lib/appetite/` defines the rules; `src/features/triage/`
renders them. The config carries the rules in `config.appetite.rules`.

**Approach:** the appetite rule definitions in `src/lib/appetite/index.ts`
should call `getActiveConfig().appetite.rules` instead of the hardcoded
ARRAY at module scope. Material class lists, geographic scope, and
turnover bands flow through similarly.

**Risk:** medium. Triage tests assert specific rule outcomes for Greenline.
Verify that the rules in `uk-wr-mga.ts` produce identical triage verdicts
before flipping the imports. Use `npm test -- triage` after each change.

## Step 3 — Capacity — ⏳

**Where:** `src/lib/fixtures/capacityLedger.ts` hardcodes 50_000_000 cap
and 65% line. The config carries the same in `config.capacity`.

**Approach:** rewrite `getCapacityLedger()` to read from `getActiveConfig()`
and synthesize the snapshot.

**Risk:** low. The capacity gauge uses derived percentages; the absolute
numbers don't drive any test assertion.

## Step 4 — Triage checks — ⚠️

**Where:** `src/features/triage/triage-engine.ts` defines the 4 checks.
Config carries them in `config.triage.checks`.

**Approach:** the check IDs and labels should come from config; the *logic*
(the check predicates) stay in code. The `logic.kind` field on each
config check tells the engine which predicate to invoke.

**Risk:** medium. Greenline E2E asserts each check passes; verify the
config's check ordering matches what the test expects.

## Step 5 — Rating engine cells — ⛔ DEFER

**Where:** `src/lib/rating/` carries cell definitions + compute logic.

**Why deferred:** the rating engine produces the £38,265 number that
multiple integration tests assert against. Any refactor here risks
breaking `greenline-e2e`, `cancellation-walkthrough`, `full-lifecycle`,
and `mta-replay` tests simultaneously. The compute logic is also more
than just data — it's expressions over the submission shape.

**Recommended approach when picked up:** keep cell *bodies* (compute
logic) in code; move only cell *metadata* (id, label, citation rule)
to config. The engine is then "compute logic indexed by config-defined
cells" rather than "compute logic with hardcoded cell metadata."

## Step 6 — Recommendation factors — ⚠️

**Where:** `src/lib/recommendation/recommendation-engine.ts` (origination,
modules 6) and `src/lib/renewal/recommendation.ts` (renewal, module 11).
Config carries the 7 factors in `config.recommendation.factors`.

**Approach:** factor IDs, labels, and weight defaults move to config;
compute predicates stay in code. The renewal-weight override logic
already exists in `src/lib/renewal/recommendation.ts` — wire it to read
`renewalWeight` from config.

**Risk:** medium. Both `greenline-e2e` and `full-lifecycle` assert
specific factor verdicts. Verify identical output post-refactor.

## Step 7 — Subjectivity catalog — ⏳

**Where:** `src/lib/fixtures/subjectivities.ts` carries the catalog. Config
carries it in `config.subjectivities.types`.

**Approach:** rewrite the fixture to read from `getActiveConfig()`.

**Risk:** low. Subjectivities are created at bind/MTA/renewal but their
*content* is mostly display strings.

## Step 8 — Wording library — ⏳

**Where:** `cl.14` body text is in `src/features/cancellation/...` (look
for `'In the event of cancellation'`). Config carries clauses in
`config.wording.clauses`.

**Approach:** read clause text from config; the cancellation refund
mechanics (the £28,356 calculation) are unaffected.

**Risk:** low (display only).

## Step 9 — Cancellation reasons — ⚠️

**Where:** `src/lib/cancellation/index.ts` exports `REASON_RULES`. Config
carries them in `config.cancellation.reasons`.

**Approach:** rewrite `REASON_RULES` to derive from `getActiveConfig().cancellation.reasons`.

**Risk:** medium. The cancellation-walkthrough integration test asserts
£28,356 for short-rate refund; the 7.5% short-rate penalty must round-trip
through the config exactly.

## Step 10 — Competitor intel — ⏳

**Where:** `src/lib/fixtures/competitiveIntel.ts`,
`src/lib/fixtures/lossesToCompetitors.ts`, `src/features/recommendation/`,
and `src/lib/renewal/runRenewalCeremony.ts` (the `SHARP_COMPETITOR_HOLD_FLOOR`
constant). Config carries competitors in `config.competitors.competitors`.

**Approach:** competitor names and discount ranges read from config.
The hold-floor (£50,500) is currently a hardcoded constant; either move
to config under a new `competitorIntel.holdFloors` field, or derive
from the recommended competitor's `typicalDiscountRange`.

**Risk:** low — competitor data is largely informational.

## Step 11 — Enrichment sources — ⏳

**Where:** `src/lib/fixtures/enrichmentSources.ts`. Config carries them
in `config.enrichmentSources`.

**Approach:** rewrite the fixture to read from `getActiveConfig()`.

**Risk:** low. The enrichment phase emits source-citation events; the
event payloads should remain byte-identical (existing source IDs match
the config IDs by design).

## Step 12 — Broker fixtures — ⏳

**Where:** Sarah Whitfield / SureStep references in
`src/lib/fixtures/greenline.ts`, `src/lib/fixtures/listingDemo.ts`,
and `src/lib/fixtures/ledgerHistory.ts`. Config carries broker profiles
in `config.metadata.primaryBrokerExamples`.

**Approach:** rewrite the fixtures to reference broker profiles by id
(`config.metadata.primaryBrokerExamples.find(b => b.id === 'BROKER-SURESTEP')`).
This keeps the fixture content identical but locates the source of
truth in one place.

**Risk:** low. The Greenline submission's broker name is asserted only
as a literal in a few places — safe to swap.

## Step 13 — Autonomy policy defaults — ⛔ DEFER

**Where:** `src/lib/fixtures/autonomyPolicy.ts` defines the 5 decision
classes with their must-match conditions and recall windows. The config
currently re-exports this via `config.autonomy.policy`.

**Why deferred:** the autonomy policy is consumed by `useAutonomy` which
is initialized at module load. Reading config from inside the autonomy
store init has a circularity concern (config tests import the policy;
the autonomy store imports the policy fixture). Resolvable but needs a
small rearrangement of imports.

**Recommended approach when picked up:** make `getSeedAutonomyPolicy()`
itself read from `getActiveConfig().autonomy.policy`, which already
contains the same content. The fixture file becomes a re-export of
the config, breaking the circularity.

## Step 14 — Branding — ⏳

Covered by the masthead refactor noted under Step 1 above.

The accent color (`var(--color-accent)` = `#C96342`) is currently a
CSS custom property defined in `src/styles/global.css`. To make it
configurable would require a runtime CSS variable injection — a separate
small refactor that's worth doing cleanly when a second tenant arrives.
For now the config carries the value (`config.branding.accentColor`)
and any non-CSS access reads from there.

---

## Verification gates

After each completed step, run:

```
npm run build && npm test
```

Critical numerical assertions that must continue to hold:
- Greenline bound premium **£38,265** (rating step 5; do not refactor)
- Cancellation short-rate refund **~£28,356** (steps 8 & 9)
- Year-2 defence pricing produces **3 options** with hold-floor **£50,500** (steps 10)
- Year-1 review LR ≈ **38%** (subjectivity catalog step 7 affects the
  count, not the LR)

If any of those numbers move, stop and diagnose before proceeding.

---

## When all steps are done

Run the thought experiment from the original spec:

> Could you write `src/config/tenants/uk-wi-ma.ts` (W&I/M&A line) by
> copying `uk-wr-mga.ts` and changing values?

If yes, the extraction is complete. If you find yourself reaching into
component files to change behaviour for a hypothetical second tenant,
those files are still coupling content with code — finish the wiring
there before declaring done.
