# Architecture

RanBerri is a single-page MVP. There is no backend, no router, and no auth.
State lives in a Zustand store with localStorage persistence; runtime
validation at boundaries uses Zod. This document is for the people building
modules 2&ndash;6 against the module 1 shell.

## The data flow as a DAG

The cockpit is a directed acyclic graph of derived state, anchored by the
three-layer `Field<T>` primitive. The DAG runs left-to-right; arrows mean
&ldquo;is an input to&rdquo;.

```
              broker email + slip
                      │
                      ▼
            ┌─── Submission ───┐
            │   Field<T> per    │
            │   attribute       │
            └─────────┬─────────┘
                      │
                effectiveValue()
                      │
        ┌─────────────┼─────────────────┐
        ▼             ▼                 ▼
   Enrichment     Conflicts         Rating inputs
   (external)   (broker vs sys.)         │
        │             │                  ▼
        └─────────────┴────────────►  Rating
                                        │
                                        ▼
                                     Quote slip
                                        │
                                        ▼
                              Bind recommendation
                                        │
                                        ▼
                              Decision (bind/refer/NTU)
                                        │
                                        ▼
                              Audit event (the spine)
```

Every node downstream of `Submission` is an **artifact**. Every artifact has a
`computedAt` timestamp in the store. An artifact is **stale** when any of its
source fields was extracted or corrected after it was last computed.

Staleness propagates downstream automatically (a stale rating implies a stale
quote implies a stale recommendation), but **recomputation does not**. The
user must click rerun. That single rule is the defining constraint of the
product: predictability over convenience.

## The three-layer field model in code

```
src/lib/field/
  types.ts        Field<T>, SystemExtracted<T>, UnderwriterCorrected<T>
  field.ts        createField, extractField, correctField, clearCorrection,
                  effectiveValue, effectiveLayer, isCorrected, isStale
  field.test.ts   verifies effectiveValue precedence
```

Precedence (verified by unit test):

```
underwriterCorrected.value
  ?? systemExtracted.value
  ?? brokerStated
```

`isStale(artifactComputedAt, sourceFields[])` returns `true` when any source
field was touched (extracted or corrected) after the artifact was last
computed, or when the artifact has never been computed at all.

## State shape

```
src/store/store.ts

RanBerriState {
  submission: Submission | null            // module 2 loads this
  auditLog:   AuditEvent[]                 // append-only
  artifacts:  Record<ArtifactKey, { computedAt: string | null }>
                                           // enrichment, conflicts, rating,
                                           // quote, recommendation
  lifecycle:  { cursor, now }              // ribbon scrubbing
  ui:         { canvasMode }               // closed | compact | expanded

  setSubmission, appendAuditEvent, correctField,
  markArtifactComputed, markArtifactStale,
  scrubLifecycle, setCanvasMode, reset
}
```

Two invariants the store enforces, which later modules must respect:

1. **Field corrections invalidate the artifact closure derived from the
   dependency graph.** `applyCorrection(path, correction)` reads the
   `Field` at `path`, stamps `underwriterCorrected`, writes it back into
   the submission tree, then walks `DEPENDENCY_GRAPH` to find every
   artifact whose `sources` include the corrected path (or include a
   pattern that matches it via the `[*]` glob), takes the transitive
   closure over `downstream` edges, and clears `computedAt` on exactly
   that set. Conservative fallback: if no artifact registers the path
   as a source, every artifact is invalidated &mdash; the graph is an
   optimisation, not a safety boundary. Recomputation remains explicit:
   the user clicks rerun.
2. **Audit events are append-only.** Use `appendAuditEvent`; never
   mutate or remove an existing entry. Every `applyCorrection` call
   writes one `field.corrected` plus one `artifact.stale` per
   invalidated artifact, so the DecisionTrail shows both the cause and
   each effect.

## The dependency graph

`src/lib/deps/graph.ts` declares the DAG:

```
    ┌──── enrichment ───┐
    │         │         │
    ▼         ▼         │
 conflicts ── rating ── quote ── recommendation
```

Each artifact has `sources` (submission field paths it reads from,
supporting `sites[*].address` style globs) and `downstream` (other
artifacts that consume its output). `affectedArtifacts(path)` finds
direct hits via `pathMatches`, then takes the transitive closure over
`downstream`.

Worked example. Correcting `insured.turnover`:

- Direct hits: `conflicts` and `rating` register `insured.turnover` in
  `sources`. `enrichment` does not.
- Closure adds: `quote` (downstream of rating + conflicts),
  `recommendation` (downstream of all three).
- Result: `{conflicts, rating, quote, recommendation}` invalidated;
  `enrichment` stays valid because Companies House data does not depend
  on turnover.

## The audit event union

`src/lib/audit/types.ts` is a discriminated union covering every meaningful
state transition. Each module owns its own kinds and adds them to the union.
Modules 2&ndash;6 emit the kinds whose names match their stage
(`submission.received`, `extraction.completed`, `enrichment.completed`,
`conflict.flagged`, `field.corrected`, `rating.computed`, `quote.issued`,
`recommendation.generated`, `decision.recorded`, `artifact.stale`).

## The two routes

The app ships with a minimal hash router (`src/app/router.ts`):

- **`/` &mdash; Cockpit.** The working product. Full-viewport workstation.
  - `TopBar` (44px): wordmark, folio breadcrumb, environment pill, user.
  - `QueueRail` (left, 268px): the inbox. Empty in module 1; module 2
    seeds the Greenline submission as the first row.
  - Canvas column: subject strip + embedded compact `LifecycleRibbon` +
    body. The body fills the rest of the viewport and is empty until
    module 2.
  - `DecisionTrail` (right, 296px): reads the audit log directly.
- **`#/pitch` &mdash; Pitch.** Document-style keynote layout reserved for
  Lloyd&rsquo;s-grade stills. The same primitives, arranged as masthead
  + editorial hero + ribbon-as-card. The cockpit is the product; the
  pitch view is for screenshots.

```
src/features/lifecycle/
  TopBar.tsx            workstation top strip (used by Cockpit)
  Masthead.tsx          document-style header (used by Pitch)
  Hero.tsx              editorial headline; &ldquo;cockpit&rdquo; in coral italic
  LifecycleRibbon.tsx   bare ribbon; `compact` prop tightens for embedding
  DecisionTrail.tsx     audit log rail; `side` prop flips border
src/features/queue/
  QueueRail.tsx         persistent inbox rail
src/app/
  App.tsx               route switch
  router.ts             hash router (cockpit | pitch)
  Cockpit.tsx           workstation composition
  Pitch.tsx             keynote composition
```

The cockpit body is deliberately empty in module 1. Module 2 fills it
with the submission canvas (broker email at top, AI extraction in the
margin, slip sealed underneath).

## Folder map

```
src/
  app/              App.tsx, router, Cockpit, Pitch
  features/
    lifecycle/      module 1 — the cockpit shell
    queue/          QueueRail (left inbox)
    intake/         module 2 (planned)
    enrichment/     module 3 (planned)
    rating/         module 4 (planned)
    recommendation/ module 5 (planned)
    decision/       module 6 (planned)
  components/       shared UI primitives — Button, Pill, Card, Hairline
  lib/
    field/          Field<T> + helpers + tests
    paths/          getAtPath, setAtPath, pathMatches (glob)
    deps/           ArtifactKey, DEPENDENCY_GRAPH, affectedArtifacts, isField
    audit/          AuditEvent types + append-only log helpers
    fixtures/       submission domain types (Greenline fixture lands in M2)
  store/            Zustand store + integration tests
  styles/           global.css with Tailwind v4 @theme tokens
```

## Design tokens

All tokens live in `src/styles/global.css` under the `@theme` directive.
Aesthetic invariants (deviating from these makes the product look generic):

- Surfaces are warm cream (`#FAF9F5`), never cool grey.
- Borders are 0.5px hairlines, never 1px.
- Border radii: 6px cards, 4px buttons, 1px pills.
- Two font weights only: 400 regular, 500 medium. Never 600 or 700.
- No gradients. No shadows beyond focus rings.
- Sentence case everywhere except mono eyebrow labels.
- Body prose (the &ldquo;AI proposes&rdquo; voice) uses Source Serif 4. UI
  uses Inter. Marginalia and the &ldquo;now&rdquo; label use italic serif.
- Lucide outline icons sized 14&ndash;17px. No emoji.
