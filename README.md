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
- Audit log: append-only event union covering every meaningful state
  transition the later modules will emit.
- Zustand store with `immer` and `localStorage` persistence. The
  `correctField` action invalidates every downstream artifact when an
  underwriter overrides a value.
- **Cockpit (`/`)** — the workstation. Full viewport, no document
  scrolling. Thin top bar with folio + environment + user; persistent
  left `QueueRail` (inbox); canvas column with subject strip, embedded
  compact `LifecycleRibbon` (5 milestones, 3 phases, 2 italic seam
  labels, coral playhead), and body; persistent right `DecisionTrail`.
- **Pitch (`#/pitch`)** — keynote/document layout for Lloyd&rsquo;s-grade
  stills. Editorial hero with the &ldquo;cockpit, not orchestration
  layer&rdquo; framing and the lifecycle ribbon as a card. Use this view
  for screenshots; the cockpit is the working product.

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
