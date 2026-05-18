# RanBerri / PASLite — Workflows

This document is a tour of every end-to-end workflow that lives in the
cockpit. The product (codenamed **RanBerri**, repository **PASLite**) is an
AI-native policy administration cockpit for a UK Waste & Recycling MGA. It is
a single-page app with no backend or auth: state is event-sourced into an
append-only audit log persisted to `localStorage`, and replayed on rehydrate.
Every workflow below is therefore implemented as **emit-event → replay
derives state → UI re-renders**.

For the underlying primitives (three-layer `Field<T>`, dependency graph,
artifact staleness, audit log) see `ARCHITECTURE.md`. For module-by-module
build notes see `README.md`.

---

## How to read this document

For each workflow you get:

- **Purpose** — what user goal it serves.
- **Entry points** — route, button, or upstream event that starts it.
- **Lifecycle stage** — which ribbon milestone(s) it advances.
- **Key files** — the engine, the React surface, and any fixture data.
- **Steps** — the ordered transitions, with the audit events emitted at each.
- **Outputs / side effects** — artifacts marked computed/stale, downstream
  cascades, banners.

The numbering corresponds to the *modules* used in the codebase
(`README.md`'s "What's built" section) and the lifecycle ribbon's phases:
**Quote → Quoted → Bind → MTA → Cancel → Renewal**, plus the cross-cutting
listing, autonomy, and ledger workflows.

---

## 0. App shell & routing

**Entry points** — hash router in `src/app/router.ts`. The routes are:

| Hash                 | Route name        | Surface                                |
| -------------------- | ----------------- | -------------------------------------- |
| `#/` (default)       | `listing`         | `ListingPage` — book of submissions    |
| `#/cockpit`          | `cockpit`         | `Cockpit` — workstation canvas         |
| `#/submission/<ref>` | `submission`      | `Cockpit` (drilled into a submission)  |
| `#/policy/<ref>`     | `policy`          | `Cockpit` (drilled into a bound policy)|
| `#/pitch`            | `pitch`           | `Pitch` — keynote/document layout      |
| `#/settings/autonomy`| `autonomy-admin`  | `AutonomyPolicyAdmin`                  |
| `#/exceptions`       | `exceptions`      | `ExceptionQueuePage`                   |
| `#/ledger`           | `ledger`          | `LedgerPage`                           |
| `#/ledger/<class>`   | `ledger-class`    | `LedgerSectionDetail`                  |

**Bootstrap** — `App.tsx` mounts `useSyncBootstrap()` once, which initialises
the sync orchestrator (`src/lib/sync`). The orchestrator wires the current
submission id, the audit log, and an `applyServerEvents` callback. When
`VITE_SERVER_URL` is unset the cockpit runs local-only.

---

## 1. Listing — book of business

**Purpose** — the underwriter's home page. A four-section list of every
submission/policy in flight, with filters, search, and drill-in.

**Entry point** — `#/` (`ListingPage` in `src/features/listing/ListingPage.tsx`).

**Sections** (defined by `ListSection` and the listing fixture in
`src/lib/fixtures/listingDemo.ts`):

1. **Needs your attention** — recommendation-ready, exceptions, chase due.
2. **In progress** — currently being worked.
3. **Bound in force** — live policies (Greenline POL-29481 anchors this).
4. **Closed** — declined / NTU / lapsed.

**Key files** —
- `src/features/listing/ListingPage.tsx`
- `src/features/listing/SubmissionRow.tsx`, `HeroStrip.tsx`, `NavStrip.tsx`
- `src/features/listing/listingStore.ts` — its own zustand sub-store
  (filter, query, search, chase receipts, drill receipts). Kept separate from
  the main audit-log so listing UI state never pollutes replay.
- `src/lib/fixtures/listingDemo.ts` — 14 demo entries.

**Steps** —
1. User lands on `#/`. `listingStore` rehydrates filter/query/entries from
   `localStorage` under key `ranberri.listing.v0`.
2. Filter pill or search box updates `filter`/`query`; rows re-filter.
3. Click row → `setDrilledFromListing({ ref })` and navigate to
   `#/submission/<ref>` or `#/policy/<ref>` (which both render `Cockpit`).
4. When the underlying workflow commits (bind, MTA, cancel, renewal) the
   cockpit surfaces a `BindCompletionBanner` with "Return to all submissions
   →"; clicking it clears `drilledFromListing` and returns to the listing.
5. **Inline chase** — for needs-attention rows the `InlineChaseEmailModal`
   composes a chase email; `recordChase(ref)` stamps `lastChaseAt`.

**Note** — only the Greenline submission has live audit-replay data. Other
rows are decorative fixtures so the canvas always shows Greenline's state
regardless of which ref was drilled into.

---

## 2. Submission intake & extraction

**Purpose** — receive a broker email + slip, run cinematic AI extraction,
populate the three-layer `Field<T>` tree, and let the underwriter inspect or
correct individual fields.

**Entry point** — empty canvas in the cockpit, "Receive new submission"
button (`src/features/intake/IntakeButton.tsx`).

**Lifecycle stage advanced** — the ribbon's `quote` milestone begins
populating.

**Key files** —
- `src/features/intake/extraction-engine.ts` — the orchestrator.
- `src/features/intake/ExtractionSequence.tsx` — the ~4-second cinematic.
- `src/features/intake/ExtractedView.tsx` — editorial extracted view.
- `src/features/intake/FieldLine.tsx`, `Inspector.tsx`, `CorrectionInline.tsx`
  — per-field click-to-inspect, click-to-correct.
- `src/features/intake/intakeStore.ts` — UI phase (`receiving`, `reading`,
  `extracting`, `complete`).
- `src/features/intake/SourceDocPreview.tsx` — slip pages with line
  highlights.
- `src/lib/fixtures/greenline.ts` — the canonical UK W&R submission.

**Steps** (timings in `extraction-engine.ts`):

| T (sec) | Phase       | Event(s) emitted                                            |
| ------- | ----------- | ----------------------------------------------------------- |
| 0.0     | receiving   | `email.received` (broker)<br>`submission.created` (broker layer snapshot) |
| 0.3     | reading     | slip pages flash p1→p4                                      |
| 1.2     | extracting  | `extraction.fieldExtracted` per field, ~150ms stagger; same event drives both the audit trail and materialised state |
| 3.5     | settling    | `extraction.completed`<br>`gap.flagged` (fire-suppression)  |
| 3.8     | complete    | intake phase → `complete`                                   |

**Re-extraction** —
- Re-emits `submission.created` (replay treats this as a tree replacement) +
  per-field events.
- Preserved underwriter corrections are then re-applied via
  `restoreCorrection`, which emits `field.corrected` with
  `actor: { kind: 'system' }` and `note: 'preserved across rerun'`.
- Emits `extraction.rerun` with `preservedCorrections` count.

**Inline correction** — `Inspector` opens on any field click. The "correct
this" affordance calls `applyCorrection(path, correction)` on the store
which:
1. Reads the `Field<T>` at `path`.
2. Walks `DEPENDENCY_GRAPH` to find the affected closure.
3. Emits one `field.corrected` event plus one `artifact.stale` per affected
   artifact.
4. Surfaces a marginalia note ("corrected from £8,420,000") and a staleness
   banner above any stale downstream sections.

---

## 3. Enrichment & conflict resolution

**Purpose** — call four mock external sources, surface cross-source
conflicts and missing-but-required gaps, and force the underwriter to record
a resolution before downstream stages proceed.

**Entry point** — auto-fires immediately after `extraction.completed` settles
and after every subsequent re-extraction (cascading rerun).

**Lifecycle stage advanced** — still inside the `quote` phase.

**Key files** —
- `src/features/enrichment/enrichment-engine.ts` — fires all four sources in
  parallel with the latencies listed below.
- `src/features/enrichment/EnrichmentSection.tsx` — the canvas section.
- `src/features/enrichment/ConflictCard.tsx` — 3-column "two voices" UI.
- `src/features/enrichment/GapCard.tsx` — present / absent / request from
  broker.
- `src/features/enrichment/ConfirmedSourcesPanel.tsx` — hairline list of
  positive verifications.
- `src/features/enrichment/SourceCard.tsx`, `ResolvedRow.tsx`
- `src/lib/fixtures/enrichmentSources.ts` — the four sources.
- `src/lib/conflict/` — cross-source conflict detection.

**Sources & latency**:

| Source                  | Latency |
| ----------------------- | ------- |
| Internal Loss Index     | 200 ms  |
| Experian Sanctions      | 400 ms  |
| Companies House         | 800 ms  |
| EA Permit Registry      | 1100 ms |

**Steps** —
1. `enrichment.started` per source on dispatch.
2. Each source settles; emits `enrichment.sourceCompleted` with raw payload.
3. Cross-source comparator surfaces conflicts (e.g. Companies House FY23
   £7.91M vs broker FY24 £8.42M) → `conflict.detected`.
4. Gaps detected (fire-suppression disclosure missing) → `gap.flagged`.
5. `enrichment.completed`.
6. Underwriter resolves each conflict / gap. Each resolution emits
   `conflict.resolved` or `gap.resolved` with the chosen value, the radio
   pick, and the required reason.
7. Once all conflicts/gaps are resolved, **triage auto-fires**.

**Conflict-resolution UI** — the typography is the design. Broker column in
italic Source Serif 4 (narrative voice). External column in mono tabular
numerics (regulator voice). Underwriter's call on the right with three radios
+ required free-text reason.

**Scope** — only **cross-source conflicts** and **gap detection** are in
scope. Self-conflicts (broker doc vs itself page-to-page) and temporal
conflicts (broker data superseded by latest filing) are deliberately
out-of-scope to preserve the cognitive contrast (`ARCHITECTURE.md` §
"Conflict scope").

---

## 4. Triage — appetite + capacity gate

**Purpose** — apply a deterministic rules engine to decide whether the risk
is in appetite and within capacity. Output is one of three verdicts: **PASS**,
**REFER**, **DECLINE**.

**Entry point** — auto-fires once enrichment is settled **and** all
conflicts/gaps are resolved.

**Key files** —
- `src/features/triage/triage-engine.ts` — orchestrator.
- `src/lib/appetite/` — pure rule functions.
- `src/features/triage/CheckRow.tsx`, `CheckDetailCard.tsx`
- `src/features/triage/CapacityGauge.tsx` — animated fill.
- `src/features/triage/VerdictPanel.tsx`, `Banners.tsx`
- `src/features/triage/OverrideModal.tsx`, `ReferralModal.tsx`,
  `DeclineModal.tsx`

**Rule families** —

| Family    | Rule IDs              | Concern                                                       |
| --------- | --------------------- | ------------------------------------------------------------- |
| APP-xxx   | APP-001 … APP-006     | LOB, jurisdiction, turnover band, site count, materials, CH status |
| CAP-xxx   | CAP-001, CAP-002      | Capacity fit, capacity margin                                 |
| SUB-xxx   | SUB-001, SUB-002      | Required disclosures present                                  |
| SAN-xxx   | SAN-001, SAN-002      | Sanctions clean                                               |

**Steps** —
1. `triage.started`.
2. Each check resolves on a 300ms cinematic stagger; emits
   `triage.checkCompleted` with rule citation, rationale, outcome glyph
   (✔ / ⚠ / ✗).
3. Verdict derived from worst outcome → `triage.completed`.
4. Underwriter can **override** any check (`OverrideModal`) — emits
   `triage.checkOverridden` with required reason. Override sits alongside
   the original outcome in the audit log; verdict re-derives.
5. Three **terminal actions** with hierarchy by verdict:
   - **Proceed to rating** (primary on PASS) — advances to rating.
   - **Refer to senior** (primary on REFER) — modal captures reviewer +
     urgency + reason; emits `triage.referred`.
   - **Decline** (primary on DECLINE) — modal captures category + detail +
     optional broker NTQ email; emits `triage.declined` and fires a
     placeholder for the NTU loss-capture flow.

**Read-only enforcement** — once `triage.referred` or `triage.declined`, the
canvas surfaces a banner, every Save button is disabled, and the store
itself rejects mutations via `src/lib/readOnly.ts`. Lifecycle ribbon,
decision trail, and inspectors stay live for historical review.

**Stale propagation** — any upstream change marks triage stale and surfaces
*rerun triage* in the section header.

---

## 5. Rating — sealed premium

**Purpose** — produce a deterministic Tier-2 W&R premium from the effective
field values.

**Entry point** — auto-fires when triage settles PASS, or when the
underwriter clicks *rerun rating*.

**Key files** —
- `src/features/rating/rating-engine.ts` — sealed deterministic engine.
- `src/features/rating/RatingSection.tsx` — eight cells + verdict.
- `src/features/rating/CellRow.tsx`, `CellInspector.tsx` — per-cell formula
  + inputs + what-if sensitivity slider.
- `src/features/rating/RatingVerdict.tsx` — £-in-serif verdict card.
- `src/lib/rating/` — calc, version, SHA.

**Cells** — A1, B14, C22, D31, E38, F44, G51, H58. Each rounded to whole
pounds. Versioned `recyclesure_v3.2.xlsx · sha-7f2a`. Same inputs → same
output. Greenline default state → **£38,265**.

**Steps** —
1. `rating.started`.
2. Cells reveal on a 120ms stagger; emits `rating.cellComputed` per cell.
3. H58 GROSS PREMIUM lands in coral with a 200ms pause.
4. `rating.computed` with the premium, the cell map, and the engine SHA.
5. Cell inspector — what-if slider (B14 turnover, F44 LR) is *non-binding*;
   commitment requires correcting upstream and rerunning.

---

## 6. Quote slip + send-to-broker

**Purpose** — render a Lloyd's-grade quote slip and send it to the broker
with a streaming covering email.

**Entry point** — auto-renders once rating settles. **Send** is user-driven.

**Lifecycle stage advanced** — advances `lifecycle.now` to **Quoted** (~14%
on the ribbon) on send.

**Key files** —
- `src/features/quote/QuoteSection.tsx`
- `src/features/quote/QuoteSlip.tsx` — Source Serif 4, mono refs, italic
  warranties, paper-warm background.
- `src/features/quote/EditableField.tsx`, `WarrantiesList.tsx` — inline
  edits.
- `src/features/quote/SendModal.tsx` — two-column overlay.
- `src/features/quote/EmailDraftEditor.tsx` — covering email, streams
  word-by-word over ~1.5s.
- `src/features/quote/Banners.tsx` — stale-quote banner.

**Steps** —
1. Slip auto-generates from rating output.
2. Underwriter edits coverage / term / aggregate / warranty text /
   subjectivities / signature inline → each edit emits `slip.fieldEdited`
   (30s coral dot, hover surfaces edit history). Refs, premium, and
   inception are **not** editable here — correct upstream.
3. Click **Send** → `SendModal` opens.
4. Email composition streams in word-by-word (the only place streaming
   text earns its place — the AI is genuinely writing).
5. User edits emit `email.edited`.
6. **Send** mocks the network (600ms) and emits `quote.sent`.
7. Submission state → `quote-sent`. Lifecycle cursor → **Quoted**. Canvas
   info banner: *Quote sent to Sarah Whitfield · awaiting response*.

**Stale-quote pattern** — if rating is invalidated after the quote was sent,
the banner flips to warn-bg with *Sent quote is stale · current rating
produces £X · consider sending a revised quote* and a `[Send revised quote]`
affordance reopens `SendModal`. On re-rate, `slip.regenerated` records the
count of slip-text edits preserved.

---

## 7. Recommendation — bind / refer / NTU

**Purpose** — the AI's bind recommendation, grounded in historical binders
and losses-to-competitors. Sits between rating and bind.

**Key files** —
- `src/features/recommendation/recommendation-engine.ts`
- `src/features/recommendation/RecommendationSection.tsx`
- `src/features/recommendation/VerdictPanel.tsx` — BIND / REFER / NTU.
- `src/features/recommendation/NarrativePanel.tsx` — narrative rationale.
- `src/features/recommendation/FactorRow.tsx`, `FactorDetailCard.tsx` —
  per-factor evidence.
- `src/features/recommendation/SimilarBindersTable.tsx`,
  `SimilarLossesTable.tsx` — cohort drill-down.
- `src/features/recommendation/CompetitiveIntelCard.tsx` —
  losses-to-competitors.
- `src/features/recommendation/RecordDetailModal.tsx`,
  `DeepDiveInspector.tsx`

**Steps** —
1. `recommendation.started`.
2. Engine computes factors against the historical book.
3. Verdict + confidence band emitted as `recommendation.generated`.
4. The underwriter can drill into any factor / similar binder / similar
   loss; each drill emits a record-view audit event.

---

## 8. Bind ceremony

**Purpose** — the moment a slip becomes a policy. Four-hash signing
ceremony covering premium, subjectivities, sanctions, and capacity. This is
the spine of the product.

**Entry point** — *Begin bind* button on the canvas (only enabled when
`submissionState ∈ {quote-sent, bind-pending, rating-pending}`).

**Lifecycle stage advanced** — **Bind**.

**Key files** —
- `src/lib/bind/runBindCeremony.ts` — orchestrator. Each action emits one
  audit event; replay reconstructs ceremony state.
- `src/lib/bind/hashEngine.ts` — `computeSha(...)`.
- `src/lib/bind/validateHashes.ts` — pre-flight check; fails fast if
  inputs are inconsistent.
- `src/lib/bind/generateBindCertificate.ts`,
  `src/lib/bind/generateSchedule.ts` — post-bind artifacts.
- `src/lib/bind/deriveBoundLedgerEntry.ts` — capacity ledger entry.
- `src/features/bind/BindCeremony.tsx`, `BindIdentityStrip.tsx`,
  `HashRow.tsx`, `HashOverrideModal.tsx`, `SeamAnimation.tsx`.
- `src/lib/fixtures/subjectivities.ts`, `capacityLedger.ts`.

**Hashes confirmed** (`HashId = 'premium' | 'subjectivities' | 'sanctions' |
'capacity'` in `src/lib/bind/types.ts`; each `bind.hashConfirmed` event
records the input SHA):

1. **Premium** — quoted premium SHA must match rating output SHA;
   slip-text edits caught by `validateHashes`.
2. **Subjectivities** — derived warranty set sealed; matches what was on
   the slip at send.
3. **Sanctions** — Experian refresh timestamp inside the staleness window.
4. **Capacity** — line consumption against syndicate ledger (Greenline
   `GREENLINE_CONSUMPTION`).

**Steps** —
1. `bind.ceremonyStarted` → `submissionState = 'bind-ceremony-pending'`.
2. For each hash: `validateHashes(...)`; on mismatch surface
   `HashOverrideModal` (records `bind.hashOverridden` with reason); on
   match `bind.hashConfirmed`.
3. After all three, `bind.committed` — emits policy ref, schedule, bind
   certificate, ledger entry, derived subjectivities.
4. `SeamAnimation` plays the seal-the-slip transition; the canvas crosses
   into the **post-bind** view.

---

## 9. Post-bind canvas

**Purpose** — once a policy is bound, the canvas re-skins into a policy-
centric view: certificate, schedule, subjectivities tracker.

**Key files** —
- `src/features/postbind/PostBindCanvas.tsx`
- `src/features/postbind/BoundCertificate.tsx` — certificate render.
- `src/features/postbind/ScheduleSection.tsx` — schedule of cover.
- `src/features/postbind/SubjectivitiesPanel.tsx`,
  `SubjectivityInspector.tsx` — track subjectivities to resolution.

Subjectivity resolution emits `subjectivity.resolved`.

---

## 10. MTA (mid-term adjustment) workflow

**Purpose** — apply a mid-term change to a bound policy (e.g. add a site).
Two-hash micro-ceremony: delta-premium + capacity-update.

**Entry point** — *Receive MTA request* (demo) or inbound endorsement event;
requires `bind.phase === 'committed'`.

**Lifecycle stage advanced** — the ribbon emits a new **MTA-NN** milestone
(`MTA-04` on the first MTA for Greenline; rolls forward MTA-05, MTA-06 …).

**Key files** —
- `src/lib/mta/runMtaCeremony.ts` — orchestrator.
- `src/lib/mta/computeDelta.ts` — delta rating, time-on-risk pro-rata.
- `src/lib/mta/computeProRata.ts`
- `src/lib/mta/getPolicyStateAt.ts` — point-in-time policy state.
- `src/lib/policy/computeEndorsementId.ts` — derives the next ordinal
  from `priorEndorsementCount + versions.length + 1`.
- `src/features/mta/MtaWorkflow.tsx`, `MtaCeremony.tsx`,
  `MtaIntakeBanner.tsx`, `MtaIntakeButton.tsx`,
  `MtaScheduleSection.tsx`, `MtaScheduleSend.tsx`,
  `DeltaRatingSequence.tsx`, `PolicyContextReview.tsx`,
  `CapacityRecheckPanel.tsx`.
- `src/lib/fixtures/manchesterMta.ts` — demo MTA request.

**Steps** —
1. `mta.requestReceived` (broker actor). Resets the MTA slice if a prior
   MTA had already settled (sequential MTAs supported).
2. `mta.contextReviewed` — underwriter confirms what's changing.
3. `mta.deltaComputed` — delta premium + new annual equivalent, with a
   cinematic delta-rating sequence.
4. `mta.capacityRechecked` — line consumption against current ledger.
5. Two hashes confirmed: **delta-premium**, **capacity-update**.
6. `mta.committed` — policy version appended with the new endorsement id.
7. `mta.scheduleSent` — revised schedule to broker.

---

## 11. Cancellation workflow

**Purpose** — cancel a bound policy with a recorded refund basis and a
runoff-claim hash. Three-hash ceremony.

**Entry point** — *Receive cancellation request* button (`CancellationIntakeButton`);
requires `bind.phase === 'committed'`.

**Lifecycle stage advanced** — **Cancel**.

**Key files** —
- `src/lib/cancellation/runCancellationCeremony.ts` — orchestrator.
- `src/lib/cancellation/computeRefund.ts` — refund + clawback math.
- `src/lib/cancellation/types.ts` — `REASON_RULES`, `RefundBasis`,
  `SYNDICATE_LINE`, hash ids.
- `src/features/cancellation/CancellationWorkflow.tsx`,
  `CancellationIntakeButton.tsx`.
- `src/lib/fixtures/cancellationRequest.ts` — Greenline cancellation
  fixture.

**Refund basis** is auto-selected from the `REASON_RULES` table off the
broker's reason category, with override available.

**Three hashes**: **refund-basis**, **runoff-claim**, **bordereau**.

**Steps** —
1. `cancellation.requestReceived` (broker actor) with reason category,
   effective date, optional `switchingTo` (competitor).
2. `cancellation.basisSelected` — auto from rules or
   `cancellation.basisOverridden` with reason.
3. `cancellation.refundComputed` — pro-rata or short-rate; clawback
   if applicable.
4. Three `cancellation.hashConfirmed` events in order.
5. `cancellation.committed`.
6. `cancellation.endorsementSent` — final endorsement + bordereau to
   broker.

---

## 12. Renewal workflow

**Purpose** — succeed the policy. The most ceremonially weighty post-bind
action because the underwriter inherits a year of loss experience and must
defend the price against sharp competitors.

**Entry point** — `triggerRenewal({ daysToExpiry })` (typically 90 days
before expiry); requires `bind.phase === 'committed'`.

**Lifecycle stage advanced** — **Renewal**.

**Key files** —
- `src/lib/renewal/runRenewalCeremony.ts` — orchestrator.
- `src/lib/renewal/year1Review.ts` — claims experience review.
- `src/lib/renewal/computeYear2Rating.ts` — Year-2 rating.
- `src/lib/renewal/computeDefencePricing.ts` — defence price against
  the sharp competitor (with a £50,500 hold floor).
- `src/lib/renewal/recommendation.ts` — Year-2 recommendation.
- `src/features/renewal/RenewalWorkflow.tsx`, `RenewalCeremony.tsx`,
  `RenewalIntakeButton.tsx`, `Year1ReviewPanel.tsx`,
  `Year2ChangesPanel.tsx`, `DefencePricingPanel.tsx`,
  `RenewalRecommendationPanel.tsx`, `RenewalSlipPanel.tsx`.
- `src/lib/fixtures/greenlineYear2.ts`, `GREENLINE_YEAR1_CLAIMS`.

**Steps** —
1. `renewal.triggered` (system actor) with `renewalId = 'RNW-01'`,
   `priorPolicyRef`, `daysToExpiry`, target inception = prior expiry.
2. `renewal.year1Reviewed` — claims, loss ratio, broker changes.
3. `renewal.year2Computed` — fresh rating against Year-2 inputs.
4. `renewal.defencePriced` — competitor-aware defence price; never below
   the sharp-competitor hold floor unless overridden.
5. `renewal.recommendationGenerated`.
6. Slip + email + send — same shape as the initial quote/send flow.
7. Four `renewal.hashConfirmed` events (same hash set as bind: premium,
   subjectivities, sanctions, capacity).
8. `renewal.committed` once the broker accepts.

---

## 13. Autonomy — automated triage-auto-pass

**Purpose** — let the cockpit auto-pass clean submissions that match a
policy class (e.g. small clean recyclers under threshold). The policy is
admin-editable and every autonomous action is recordable, recallable, and
auditable.

**Entry point** — runtime hook `useAutonomyOrchestrator` mounted in the
cockpit shell. Watches the audit log for `triage.completed`.

**Key files** —
- `src/lib/autonomy/evaluatePolicy.ts` — pure evaluator over an
  `EvaluationSnapshot`.
- `src/lib/autonomy/runAutonomousAction.ts` —
  `scheduleAutonomousAction(...)`, `fireAutonomousAction(...)`.
- `src/lib/autonomy/types.ts` — `AutonomyPolicy`.
- `src/lib/fixtures/autonomyPolicy.ts` — `SEED_AUTONOMY_POLICY`.
- `src/features/autonomy/useAutonomyOrchestrator.ts` — the runtime
  glue; 10-second demo delay before firing.
- `src/features/autonomy/AutonomyPolicyAdmin.tsx` (`#/settings/autonomy`)
  — edit thresholds.
- `src/features/autonomy/EditThresholdsModal.tsx`
- `src/features/autonomy/ExceptionQueuePage.tsx` (`#/exceptions`) —
  rows that didn't match the policy.
- `src/features/autonomy/AutonomyEyebrow.tsx`,
  `AutonomyInspector.tsx`, `RecallModal.tsx`
- `src/features/autonomy/exceptionInsureds.ts`
- `src/store/autonomy.ts` — autonomy sub-store.

**Steps** —
1. `triage.completed` with PASS verdict triggers the orchestrator hook.
2. `projectSnapshot(triage, rating)` builds an `EvaluationSnapshot`.
3. `evaluatePolicy(snapshot, policy)` returns either `{ eligible: true,
   classId, conditionsMet, confidence }` or `{ eligible: false, reason }`.
4. If eligible: `scheduleAutonomousAction(...)` emits
   `autonomy.actionScheduled` with `firesAt` 10s ahead. A 1Hz tick fires
   any scheduled action whose `firesAt < now`, calling
   `fireAutonomousAction(...)` which emits `autonomy.actionFired`.
5. If ineligible: row lands in the **Exception Queue** at `#/exceptions`.
6. **Recall** — `RecallModal` cancels a scheduled action before it fires
   (`autonomy.actionRecalled`).

---

## 14. Ledger — capacity & provenance

**Purpose** — book-level view of capacity consumption across policies and
of every autonomous action the cockpit has taken. Closes the loop between
"the AI did this" and "what was the policy at the time".

**Entry points** — `#/ledger` (overview), `#/ledger/<class>` (per-class
detail).

**Key files** —
- `src/features/ledger/LedgerPage.tsx`, `LedgerHeader.tsx`,
  `LedgerNavStrip.tsx`, `LedgerSection.tsx`, `LedgerSectionDetail.tsx`
- `src/features/ledger/LedgerActionRow.tsx` — row per autonomous action.
- `src/features/ledger/AutonomyProvenancePanel.tsx`,
  `AutonomyProvenanceRow.tsx` — policy version snapshot at action time.
- `src/features/ledger/AtRiskAnnotation.tsx` — flags where headroom
  has eroded.
- `src/features/ledger/ExportModal.tsx`, `ExportPreview.tsx` —
  bordereau export.
- `src/lib/ledger/` — types, queries.
- `src/lib/fixtures/capacityLedger.ts` — book-level capacity fixture.

---

## 15. Audit log — the spine

**Purpose** — the canonical persistence form. Every workflow above emits
events here; replay reconstructs `submission` and `artifacts` from the log
alone. `partialize` writes only `auditLog`, `lifecycle`, and `ui` to
localStorage — materialised state is derived.

**Key files** —
- `src/lib/audit/types.ts` — discriminated union of every event kind.
- `src/store/store.ts` — `appendAuditEvent`, `applyCorrection`,
  `restoreCorrection`.
- `src/store/replay.ts` — pure `replay(events): { submission, artifacts,
  intake }` reducer.
- `src/features/audit/AuditLogInspector.tsx`,
  `AuditEventRow.tsx`, `AuditFilters.tsx`, `AuditLogTrigger.tsx`
- `src/features/lifecycle/DecisionTrail.tsx` — right rail; reads the log
  directly.

**Invariants** —
1. The audit log is canonical; the materialised state is derived. Any
   action that mutates state without emitting a replay-sufficient event
   loses data on refresh.
2. Corrections invalidate the **artifact closure** derived from
   `DEPENDENCY_GRAPH`; unrecognised paths conservatively invalidate
   everything.
3. Re-applied corrections during rerun are **system-actored** and skip the
   dep walk (downstream was already invalidated by the snapshot
   replacement).

---

## 16. Lifecycle ribbon & historical scrubbing

**Purpose** — the spine UI. Five milestones, three phases, two italic seam
labels, a coral "now" playhead.

**Entry point** — always visible in the cockpit (`LifecycleRibbon` embedded
compact above the canvas body).

**Milestones** (`src/features/lifecycle/milestoneMeta.ts`):

| Milestone | Date source                                          |
| --------- | ---------------------------------------------------- |
| quote     | `submission.receivedAt`                              |
| quoted    | `quote.sentAt`                                       |
| bind      | `bind.committedAt`                                   |
| mta-NN    | latest `policy.versions[].signedAt`                  |
| cancel    | `cancellation.committedAt`                           |
| renewal   | `renewal.committedAt`                                |

**Historical scrubbing** — `HistoricalScrubOverlay`, `QuickJumpModal`, and
`CanvasKeyboard` together let the user drag the playhead back in time;
the canvas re-renders as a point-in-time reconstruction by replaying only
the audit events ≤ the cursor. `cursorView.ts` is the projection function.

---

## 17. Canvas mode & inspector

**Purpose** — viewport management. The cockpit body can run in three canvas
modes; the inspector docks on the right and adapts to three target kinds.

**Modes** (`ui.canvasMode` in the main store: `closed | compact | expanded`):
- **closed** — full-width canvas; inspector hidden.
- **compact** — inspector pinned right at narrow width.
- **expanded** — inspector takes the right pane; canvas narrows.

**Inspector target kinds** —
- **field** — full three-layer `Field<T>` UI with "correct this" affordance.
- **source** — raw payload from an enrichment source + latency +
  `refreshedAt`.
- **conflict** — detection metadata, resolution choices, resolution history.

**Key files** —
- `src/features/intake/Inspector.tsx` — multi-target inspector.
- `src/features/enrichment/SourceCard.tsx`,
  `src/features/enrichment/ConflictCard.tsx` — open the inspector with
  the appropriate target.
- `src/features/lifecycle/CanvasKeyboard.tsx` — keyboard shortcuts.
- `src/store/store.ts` — `setCanvasMode` action.

---

## 18. Sync — server replay (optional)

**Purpose** — when `VITE_SERVER_URL` is set, the cockpit pulls server-side
events and applies them to the local audit log.

**Key files** —
- `src/lib/sync/` — orchestrator, health check, replay applicator.
- `useSyncBootstrap` in `App.tsx` mounts it once.
- `src/features/lifecycle/SyncStatus.tsx` — top-bar status pill.

Unset env var ⇒ local-only, no-op.

---

## Dependency graph — what stales what

`src/lib/deps/graph.ts` declares the DAG used by `applyCorrection`. When the
underwriter corrects a field, only the artifacts whose `sources` match the
path (or whose ancestors do) are marked stale.

```
    ┌──── enrichment ───┐
    │         │         │
    ▼         ▼         │
 conflicts ── rating ── quote ── recommendation
```

Plus the post-bind workflows (`bind`, `mta`, `cancellation`, `renewal`)
each have their own stale guards via state-machine preconditions
(`bind.phase`, `mta.phase`, etc.) rather than dep-graph edges.

---

## Read-only & gating cheatsheet

| State                                | Effect                                                        |
| ------------------------------------ | ------------------------------------------------------------- |
| `triage.referred` / `triage.declined`| All correction / resolution / override Saves disabled; store rejects mutations (`src/lib/readOnly.ts`). |
| `submissionState !== 'quote-sent' ∧ rating ∧ bind-pending` | Bind ceremony cannot start.        |
| `bind.phase !== 'committed'`         | MTA / cancellation / renewal cannot start.                    |
| Sent quote stale                     | Banner flips warn-bg; "Send revised quote" offered.           |
| Rating stale after bind              | Schedule reissue prompted.                                    |

---

## Engines & their callers (quick index)

| Engine                                              | Callers                          |
| --------------------------------------------------- | -------------------------------- |
| `extraction-engine.ts`                              | `IntakeButton`, rerun action     |
| `enrichment-engine.ts`                              | Auto-fires post-extraction       |
| `triage-engine.ts`                                  | Auto-fires post-enrichment       |
| `rating-engine.ts`                                  | Auto-fires post-triage PASS      |
| `recommendation-engine.ts`                          | Auto-fires post-rating           |
| `lib/bind/runBindCeremony.ts`                       | `BindCeremony`, HashRow handlers |
| `lib/mta/runMtaCeremony.ts`                         | `MtaWorkflow`                    |
| `lib/cancellation/runCancellationCeremony.ts`       | `CancellationWorkflow`           |
| `lib/renewal/runRenewalCeremony.ts`                 | `RenewalWorkflow`                |
| `lib/autonomy/runAutonomousAction.ts`               | `useAutonomyOrchestrator` tick   |

---

## Where to look first

- **Want to follow one submission end-to-end?** Start in
  `src/lib/fixtures/greenline.ts`, then trace the audit log through
  `extraction-engine.ts` → `enrichment-engine.ts` → `triage-engine.ts` →
  `rating-engine.ts` → `recommendation-engine.ts` →
  `lib/bind/runBindCeremony.ts`.
- **Want to follow a post-bind change?** Read
  `lib/mta/runMtaCeremony.ts`, then `lib/cancellation/runCancellationCeremony.ts`,
  then `lib/renewal/runRenewalCeremony.ts` — they share the
  hash-ceremony pattern.
- **Want to understand staleness?** Read
  `ARCHITECTURE.md` §"State shape" + `src/lib/deps/graph.ts` +
  `applyCorrection` in `src/store/store.ts`.
- **Want to understand autonomy?** Read
  `src/lib/autonomy/evaluatePolicy.ts` and its `.test.ts` neighbour;
  `useAutonomyOrchestrator` shows how it plugs into the live cockpit.
