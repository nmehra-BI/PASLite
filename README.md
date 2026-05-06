# RanBerri

RanBerri is an AI-native policy administration cockpit for a UK waste &
recycling MGA. One canvas per risk; AI proposes in the margin; the slip stays
sealed underneath; the audit trail is the spine. The product is built around
the bind decision &mdash; the moment a slip becomes a policy, recorded with the
evidence that justified it.

## The three-layer field model

Every extracted attribute on a submission carries three values, not one:

```ts
type Field<T> = {
  brokerStated: T | null            // what the broker wrote. Immutable.
  systemExtracted: {                // what the AI parsed
    value: T | null
    confidence: number
    sourceRef: string               // e.g. "slip:p2:line14"
    extractedAt: ISO8601
    modelVersion: string            // e.g. "sonnet-4-7"
  } | null
  underwriterCorrected: {           // human override — wins when present
    value: T
    reason: string                  // free text, required
    correctedBy: string
    correctedAt: ISO8601
  } | null
}
```

The `effective` value &mdash; the one downstream computations use &mdash; is
`underwriterCorrected.value ?? systemExtracted.value ?? brokerStated`.

When the underwriter corrects a field, every artifact derived from it
(enrichment, conflicts, rating, quote, recommendation) is marked stale.
Recomputation is **explicit**: the user clicks rerun, never automatic. This is
regulated finance; predictability beats convenience. Three layers preserve a
full provenance trail: what the broker said, what the model thought, and why
the human disagreed.

## What&rsquo;s built (module 1)

- App shell: Vite + React 19 + TypeScript strict mode, Tailwind v4 with the
  warm institutional design tokens, Google Fonts (Source Serif 4, Inter,
  JetBrains Mono).
- `Field<T>` primitive: `createField`, `extractField`, `correctField`,
  `effectiveValue`, `effectiveLayer`, `isCorrected`, `isStale`. Unit-tested.
- Path helpers (`src/lib/paths`) and dependency graph (`src/lib/deps`):
  per-artifact `sources` + `downstream` edges, with the `[*]` glob for
  array elements. `affectedArtifacts(path)` returns the precise closure.
- Audit log: append-only event union covering every meaningful state
  transition the later modules will emit.
- Zustand store with `immer` and `localStorage` persistence (memory
  fallback in non-browser contexts). `applyCorrection(path, correction)`
  reads the field, stamps the underwriter layer, writes it back, and
  invalidates only the artifact closure derived from the dependency
  graph &mdash; not every artifact. Emits one `field.corrected` event
  plus one `artifact.stale` per invalidated artifact.
- **Cockpit (`/`)** — the workstation. Full viewport, no document
  scrolling. Thin top bar with folio + environment + user; persistent
  left `QueueRail` (inbox); canvas column with subject strip, embedded
  compact `LifecycleRibbon` (5 milestones, 3 phases, 2 italic seam
  labels, coral playhead), and body; persistent right `DecisionTrail`.
- **Pitch (`#/pitch`)** — keynote/document layout for Lloyd&rsquo;s-grade
  stills. Editorial hero with the &ldquo;cockpit, not orchestration
  layer&rdquo; framing and the lifecycle ribbon as a card. Use this view
  for screenshots; the cockpit is the working product.

### Module 2 — submission intake + extraction

- **Greenline fixture** (`src/lib/fixtures/greenline.ts`): a complete
  UK W&amp;R submission &mdash; broker email, four-page ACORD slip with
  numbered lines, 5-year loss runs, three EA permits. Deliberately
  carries one disclosure gap (fire suppression) and a downstream
  arithmetic inconsistency (loss-ratio summary that doesn&rsquo;t
  reconcile) for module 3 to surface.
- **Cinematic extraction**: one button on the empty canvas (&ldquo;Receive
  new submission&rdquo;) launches a ~4-second sequence. The slip pages
  flash, source lines highlight in real time as fields resolve in the
  margin, confidence dots animate in tone-coded by threshold
  (&ge;0.95 success, &ge;0.85 warn, &lt;0.85 danger). The fire-suppression
  gap pulses warn briefly to draw attention.
- **Editorial extracted view**: the AI&rsquo;s voice presenting its
  work &mdash; mono section headers, italic serif marginalia, source
  citations on hover. Not a generic dashboard.
- **Inspector + inline correction**: every extracted value is clickable;
  the inspector shows all three Field<T> layers and a &ldquo;correct
  this&rdquo; affordance. Saving fires `applyCorrection`, which walks
  the dependency graph, invalidates only the affected artifacts, emits
  audit events, and shows a marginalia note (&ldquo;corrected from
  &pound;8,420,000&rdquo;) on the canvas. A staleness banner appears
  above the body until downstream artifacts are rerun.
- **Re-extraction**: an italic &ldquo;rerun extraction&rdquo; link on the
  canvas header replays the sequence; it overwrites the system layer
  but preserves every underwriter correction in the new tree.
- **Decision trail**: chronological audit events with tone-coded dots,
  followed by pending-artifact rows for the stages module 3-5 will
  populate.

### Module 3 — enrichment + conflict resolution

- **Four mock external sources** (`src/lib/fixtures/enrichmentSources.ts`)
  with realistic latencies: Internal Loss Index (200ms), Experian
  Sanctions (400ms), Companies House (800ms), EA Permit Registry
  (1100ms).
- **Auto-fire**: enrichment runs immediately after extraction settles,
  and again after every subsequent `extraction.completed` (so a rerun
  of extraction cascades to a rerun of enrichment).
- **Cross-source conflict detection** (`src/lib/conflict/`): the
  Companies House FY23 figure (£7.91M) vs the broker's FY24 number
  (£8.42M) surfaces as a `conflict.detected` event. Self-conflicts
  and temporal conflicts are out of scope &mdash; collapsing all
  three into one UI loses the cognitive win.
- **Conflict-resolution UI**: 3-column &ldquo;two voices&rdquo; card.
  Broker column in italic serif (the human, narrative voice). External
  column in monospace tabular numeric (the regulator's voice).
  Underwriter's call on the right with three radios + required
  reason. The typographic contrast IS the design.
- **Gap-resolution UI**: simpler card for missing-but-required fields
  (the fire-suppression case). Three choices: present, absent, or
  request from broker (queues a mock email task).
- **Confirmed sources panel**: positive verifications (EA permits,
  sanctions, loss history, directors) render as a quiet hairline
  list. The system silently doing positive verification matters as
  much as the conflicts.
- **Inspector** now handles three target kinds: field (full Field<T>
  detail), source (raw payload + latency + refreshed-at), or conflict
  (detection metadata + resolution history).

### Module 4 — triage (appetite + capacity gate)

- **Four rules-based checks** (`src/lib/appetite/`): APP-001..006
  (line-of-business, jurisdiction, turnover band, site count, excluded
  materials, CH status), CAP-001/002 (capacity fit and margin),
  SUB-001/002 (required disclosures), SAN-001/002 (sanctions clean).
  Pure functions; the model surfaces the rule but never overrides it.
- **Cinematic** auto-fires after enrichment settles AND
  reconciliation is complete. Each check resolves on a 300ms stagger
  with its rule citation, rationale, and outcome glyph.
- **3-column conflict pattern** is reused for the rules: each row
  expands to a detail card with the full rule list, marginalia, and
  optional capacity gauge (animated fill on first render).
- **Override flow**: any check can be overridden with a recorded
  reason; overrides stay alongside the original outcome in the audit
  log. Verdict re-derives in the panel, surfacing a "PASS → REFER"
  notice when the override or a rerun changes the outcome.
- **Three terminal actions** with hierarchy by verdict: Proceed to
  rating (primary on PASS), Refer to senior (primary on REFER, opens
  modal with reviewer + urgency + reason), Decline (primary on
  DECLINE, opens modal with category + detail + optional broker NTQ).
  Decline triggers a module-7 placeholder (`console.info`) for the
  NTU loss-capture flow.
- **Read-only enforcement**: once referred or declined, the canvas
  surfaces a banner at the top, every correction / resolution /
  override Save is disabled, and the store actions reject mutations.
  Lifecycle ribbon, decision trail and inspectors stay live for
  historical review.
- **Stale propagation**: triage joins the dep graph between conflicts
  and rating; any upstream change marks it stale and surfaces *rerun
  triage* in the section header.

### Module 5 — rating + quote slip + send-to-broker

- **Sealed rating engine** (`src/lib/rating/`): deterministic Tier-2
  W&amp;R calculation, eight cells (A1, B14, C22, D31, E38, F44, G51,
  H58), each rounded to whole pounds. Versioned `recyclesure_v3.2.xlsx
  · sha-7f2a`. Same inputs → same output. Greenline default state
  produces **£38,265**.
- **Cinematic build-up**: cells reveal on a 120ms stagger; H58 GROSS
  PREMIUM lands in coral with an extra 200ms pause. The right column
  is the verdict card (£38,265 in serif, sealed-version mono caption).
  Click any cell to open the inspector with formula, inputs, and a
  what-if sensitivity slider (B14 turnover, F44 LR) — the slider
  doesn&rsquo;t propagate; commitment requires correcting upstream.
- **Quote slip** (`src/features/quote/QuoteSlip.tsx`): institutional
  Lloyd&rsquo;s aesthetic — Source Serif 4 body, mono refs, italic
  warranties (numbered i. ii. iii.), mono section labels tracked
  0.12em, paper-warm background, coral-mark + RanBerri wordmark in
  the corner. Premium displayed in 36px serif with coral £ accent.
  Editable: coverage description, term, aggregate, warranty text,
  validity, signature, subjectivities. Not editable: refs, premium,
  inception (correct upstream). Edits show a 30s coral dot;
  hover-tooltip surfaces edit history.
- **Two-column send overlay**: slip preview on the left (decorative,
  desaturated 0.85, scaled 0.92), email composition on the right.
  Sonnet-style covering email is generated from submission state —
  references the broker target gap, loss-ratio context, the warranties
  to flag — and **streams in word-by-word over ~1.5s** (the only
  surface in the product where streaming text earns its place; the
  AI is genuinely writing). User can edit; edits emit
  `email.edited` events.
- **Send mocks the network** (600ms), advances submission to
  `quote-sent`, advances `lifecycle.now` to the new **Quoted**
  milestone (~14% on the ribbon). Top-of-canvas info-bg banner: *Quote
  sent to Sarah Whitfield · awaiting response*.
- **Stale-quote pattern**: if rating becomes stale after the quote was
  sent, the banner flips warn-bg with *Sent quote is stale · current
  rating produces £X · consider sending a revised quote* and a
  `[Send revised quote]` affordance reopens the send modal.
- **Re-rating** preserves user edits to slip text via
  `slip.fieldEdited` events kept in the audit log; the slip
  auto-regenerates against the new premium when rating settles, and
  a `slip.regenerated` event records the count of preserved edits.
## What&rsquo;s planned

- **Module 2** &mdash; submission intake &amp; field extraction
- **Module 3** &mdash; external enrichment &amp; conflict resolution
- **Module 4** &mdash; rating engine &amp; quote slip
- **Module 5** &mdash; bind recommendation grounded in historical binders
  and losses-to-competitors
- **Module 6** &mdash; bind / refer / NTU outcome capture, including the
  who-won-it-and-at-what-price data point that improves future
  recommendations

## Local development

```sh
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run test
npm run build        # produces a static bundle in dist/
```

## Deploy

Any static host. The `dist/` directory is self-contained.

```sh
npm run build
# upload dist/ to e.g. Vercel, Netlify, S3 + CloudFront
```

## Stack

Vite, React 19, TypeScript (strict), Tailwind v4, Zustand + immer, Zod,
date-fns, lucide-react. No backend, no router, no auth in module 1.
