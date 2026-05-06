import { useState } from 'react';
import { motion } from 'framer-motion';
import { Power, Pencil, Check } from 'lucide-react';
import { Button, Pill } from '@/components';
import { useRanBerri } from '@/store';
import {
  REASON_RULES,
  commitCancellation,
  computeCancellationRefund,
  confirmCancellationHash,
  overrideCancellationBasis,
  sendCancellationEndorsement,
  type CancellationHashId,
  type RefundBasis,
} from '@/lib/cancellation';
import { deriveCursorView } from '@/lib/lifecycle/cursorView';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

export function CancellationWorkflow() {
  const cancellation = useRanBerri((s) => s.cancellation);
  const cursor = useRanBerri((s) => s.lifecycle.cursor);
  const now = useRanBerri((s) => s.lifecycle.now);
  const policy = useRanBerri((s) => s.policy);

  if (cancellation.phase === 'idle') return null;
  // In historical scrub views, hide the live workflow.
  const view = deriveCursorView({
    cursor,
    now,
    baseBindAt: policy.baseBindAt,
    versionCount: policy.versions.length,
    firstMtaSignedAt: policy.versions[0]?.signedAt ?? null,
  });
  if (view.kind === 'bind-v1') return null;

  return (
    <div>
      <CancellationBanner />
      <ReasonReviewCard />
      <RefundCalculation />
      <RunoffClaimRow />
      <BordereauRow />
      <CancellationCeremony />
      <CancellationEndorsement />
      <SendStrip />
    </div>
  );
}

function CancellationBanner() {
  const cancellation = useRanBerri((s) => s.cancellation);
  if (!cancellation.request) return null;
  if (cancellation.phase === 'sent' || cancellation.phase === 'committed') return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="hairline-b"
      style={{
        background: 'var(--color-warn-bg)',
        padding: '10px 22px',
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div className="flex items-baseline gap-3" style={{ minWidth: 0 }}>
        <Power
          size={11}
          strokeWidth={1.5}
          style={{ color: 'var(--color-warn)', position: 'relative', top: 1 }}
        />
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-warn)',
          }}
        >
          cancellation request
        </span>
        <span
          className="serif"
          style={{ fontStyle: 'italic', fontSize: 12.5, color: 'var(--color-warn)' }}
        >
          effective {DATE_FMT.format(new Date(cancellation.request.effectiveDate))} ·{' '}
          {REASON_RULES[cancellation.request.reasonCategory].label}
        </span>
      </div>
      <span
        className="mono"
        style={{ fontSize: 10.5, color: 'var(--color-warn)', letterSpacing: '0.06em' }}
      >
        from: {cancellation.request.broker}
      </span>
    </motion.div>
  );
}

function ReasonReviewCard() {
  const cancellation = useRanBerri((s) => s.cancellation);
  const [editing, setEditing] = useState(false);
  const [draftBasis, setDraftBasis] = useState<RefundBasis>('pro-rata');
  const [reason, setReason] = useState('commercial gesture for relationship preservation');
  if (!cancellation.request || !cancellation.basis) return null;
  const rule = REASON_RULES[cancellation.request.reasonCategory];
  const live = cancellation.basisOverride?.to ?? cancellation.basis;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      style={{ padding: '20px 28px' }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">cancellation · reason &amp; basis</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 14.5,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          per slip wording cl.14 · short-rate / pro-rata / void ab initio
        </div>
      </header>
      <div
        className="hairline"
        style={{
          padding: '14px 16px',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-surface)',
        }}
      >
        <KV label="reason category">{rule.label}</KV>
        <KV label="detail">{cancellation.request.reasonDetail}</KV>
        <KV label="default basis">{cancellation.basis}</KV>
        <KV label="effective basis">
          <span style={{ color: cancellation.basisOverride ? 'var(--color-accent)' : 'var(--color-ink)' }}>
            {live}
          </span>
          {cancellation.basisOverride && (
            <span
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 11.5,
                color: 'var(--color-accent)',
                marginLeft: 8,
                letterSpacing: '-0.005em',
              }}
            >
              · overridden ({cancellation.basisOverride.reason})
            </span>
          )}
        </KV>
        {cancellation.request.switchingTo && (
          <KV label="switching to">{cancellation.request.switchingTo}</KV>
        )}

        {!editing && cancellation.phase !== 'committed' && cancellation.phase !== 'sent' && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1"
            style={{
              marginTop: 10,
              padding: '4px 10px',
              borderRadius: 'var(--radius-button)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: 'var(--color-accent)',
              background: 'transparent',
              border: '0.5px solid var(--color-accent)',
            }}
          >
            <Pencil size={10} strokeWidth={1.5} />
            override basis
          </button>
        )}

        {editing && (
          <div className="hairline-t" style={{ marginTop: 12, paddingTop: 12 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              new basis
            </div>
            <select
              value={draftBasis}
              onChange={(e) => setDraftBasis(e.target.value as RefundBasis)}
              className="hairline"
              style={{
                width: 200,
                padding: '4px 8px',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-button)',
              }}
            >
              <option value="short-rate">short-rate (with cl.14 penalty)</option>
              <option value="pro-rata">pro-rata (no penalty)</option>
              <option value="void-ab-initio">void ab initio (£0 refund)</option>
            </select>
            <label
              className="eyebrow"
              htmlFor="cancel-override-reason"
              style={{ display: 'block', marginTop: 10, marginBottom: 4 }}
            >
              reason (≥10 chars)
            </label>
            <textarea
              id="cancel-override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="hairline"
              style={{
                width: '100%',
                resize: 'vertical',
                padding: '6px 10px',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 12.5,
                lineHeight: 1.55,
                color: 'var(--color-ink-soft)',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-button)',
              }}
            />
            <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  overrideCancellationBasis({
                    to: draftBasis,
                    reason,
                    overriddenBy: 'nm',
                  });
                  computeCancellationRefund();
                  setEditing(false);
                }}
              >
                Apply
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function RefundCalculation() {
  const cancellation = useRanBerri((s) => s.cancellation);
  if (!cancellation.calc) return null;
  const calc = cancellation.calc;
  const proRata =
    calc.basis === 'void-ab-initio'
      ? 0
      : Math.round((calc.annualPremium * calc.daysRemaining) / calc.daysInTerm);

  return (
    <section className="hairline-t" style={{ padding: '20px 28px' }}>
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">refund &amp; clawback</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          {calc.basis} basis · {calc.daysRemaining} of {calc.daysInTerm} days unexpired
        </div>
      </header>
      <div
        className="mono"
        style={{
          fontSize: 12,
          color: 'var(--color-ink)',
          background: 'var(--color-surface)',
          border: '0.5px solid var(--color-rule-mid)',
          borderRadius: 'var(--radius-card)',
          padding: '12px 14px',
          letterSpacing: '0.02em',
          lineHeight: 1.7,
        }}
      >
        <div>annual premium      £{calc.annualPremium.toLocaleString('en-GB')}</div>
        <div>
          pro-rata refund     £{proRata.toLocaleString('en-GB')}
          {calc.basis === 'short-rate' && ' (before cl.14 penalty)'}
        </div>
        {calc.basis === 'short-rate' && (
          <div>cl.14 penalty       −7.5% applied</div>
        )}
        <div style={{ color: 'var(--color-accent)', marginTop: 6 }}>
          REFUND              £{calc.refund.toLocaleString('en-GB')}
        </div>
        <div style={{ marginTop: 8 }}>
          commission clawback £{calc.commissionClawback.toLocaleString('en-GB')} ({calc.clawbackKind})
        </div>
      </div>
      <div className="mono" style={{ marginTop: 8, fontSize: 10.5, color: 'var(--color-ink-faint)', letterSpacing: '0.06em' }}>
        sealed v1 · {calc.sha} · audit-replayable
      </div>
    </section>
  );
}

function RunoffClaimRow() {
  const c = useRanBerri((s) => s.cancellation);
  if (!c.runoffClaim) return null;
  return (
    <section className="hairline-t" style={{ padding: '14px 28px' }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        run-off claim
      </div>
      <div
        className="serif"
        style={{ fontSize: 13.5, color: 'var(--color-ink)', letterSpacing: '-0.005em' }}
      >
        {c.runoffClaim.ref} · reserve £
        {c.runoffClaim.reserveAmount.toLocaleString('en-GB')}
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          marginTop: 4,
          lineHeight: 1.55,
        }}
      >
        {c.runoffClaim.description}
      </div>
    </section>
  );
}

function BordereauRow() {
  const c = useRanBerri((s) => s.cancellation);
  if (!c.calc) return null;
  return (
    <section className="hairline-t" style={{ padding: '14px 28px' }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        bordereau · syndicate share
      </div>
      <div
        className="mono"
        style={{ fontSize: 12, color: 'var(--color-ink)', letterSpacing: '0.02em' }}
      >
        net movement: £{c.calc.bordereauNet.toLocaleString('en-GB')} · Synd 2358 · 65% line
      </div>
    </section>
  );
}

function CancellationCeremony() {
  const c = useRanBerri((s) => s.cancellation);
  const setSeamFiring = useRanBerri((s) => s.setSeamFiring);
  const [committing, setCommitting] = useState(false);
  if (c.phase !== 'computed' && c.phase !== 'ceremony-in-progress') return null;
  if (!c.calc) return null;

  const HASHES: Array<{
    id: CancellationHashId;
    title: string;
    primary: string;
    citation: string;
  }> = [
    {
      id: 'refund-basis',
      title: 'Refund & basis',
      primary: `Refund £${c.calc.refund.toLocaleString('en-GB')} on ${c.calc.basis} basis`,
      citation: `${c.calc.sha} · cl.14 short-rate / pro-rata / void`,
    },
    {
      id: 'runoff-claim',
      title: 'Run-off claim',
      primary: c.runoffClaim
        ? `${c.runoffClaim.ref} · reserve £${c.runoffClaim.reserveAmount.toLocaleString('en-GB')}`
        : 'No run-off claim recorded',
      citation: c.runoffClaim ? c.runoffClaim.description.slice(0, 120) : '—',
    },
    {
      id: 'bordereau',
      title: 'Bordereau entry',
      primary: `Net movement £${c.calc.bordereauNet.toLocaleString('en-GB')} · Synd 2358 65%`,
      citation: 'syndicate-share refund recorded against the policy line',
    },
  ];

  const confirmedCount = c.hashes.filter(
    (h) => h.status === 'confirmed' || h.status === 'overridden',
  ).length;
  const allThree = confirmedCount === 3;

  async function onIssue() {
    if (committing) return;
    setCommitting(true);
    setSeamFiring(true);
    await new Promise((r) => setTimeout(r, 220));
    try {
      commitCancellation('nm');
    } catch (err) {
      console.error('commitCancellation failed', err);
      setSeamFiring(false);
      setCommitting(false);
      return;
    }
    await new Promise((r) => setTimeout(r, 480));
    setSeamFiring(false);
    setCommitting(false);
  }

  return (
    <section className="hairline-t" style={{ padding: '20px 28px' }}>
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">cancellation ceremony</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 14.5,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          three hashes · refund · run-off · bordereau
        </div>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {HASHES.map((h, i) => {
          const record = c.hashes.find((x) => x.id === h.id);
          const signed =
            record?.status === 'confirmed' || record?.status === 'overridden';
          return (
            <div
              key={h.id}
              className="hairline"
              style={{
                borderRadius: 'var(--radius-card)',
                padding: '12px 16px',
                background: 'var(--color-surface)',
                display: 'grid',
                gridTemplateColumns: '22px 1fr auto',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  marginTop: 2,
                  borderRadius: 999,
                  border: `1px solid ${signed ? 'var(--color-success)' : 'var(--color-rule-mid)'}`,
                  background: signed ? 'var(--color-success)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {signed && <Check size={10} strokeWidth={2} color="white" />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--color-ink-faint)',
                  }}
                >
                  hash {i + 1} · {h.title}
                </div>
                <div
                  className="serif"
                  style={{
                    fontSize: 13.5,
                    color: 'var(--color-ink)',
                    marginTop: 4,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {h.primary}
                </div>
                <div
                  className="serif"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 11.5,
                    color: 'var(--color-ink-faint)',
                    marginTop: 3,
                  }}
                >
                  ↳ {h.citation}
                </div>
              </div>
              <div style={{ paddingTop: 2 }}>
                {signed ? (
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: 'var(--color-ink-mute)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    ✓ signed
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => confirmCancellationHash(h.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-button)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--color-bg)',
                      background: 'var(--color-accent)',
                      border: '0.5px solid var(--color-accent)',
                    }}
                  >
                    Confirm hash →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="hairline-t"
        style={{
          marginTop: 18,
          paddingTop: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: allThree ? 'var(--color-success)' : 'var(--color-ink-mute)',
            letterSpacing: '-0.005em',
          }}
        >
          {confirmedCount} of 3 confirmed{allThree ? ' · ready to issue' : ''}
        </div>
        <button
          type="button"
          onClick={onIssue}
          disabled={!allThree || committing}
          style={{
            padding: '7px 14px',
            borderRadius: 'var(--radius-button)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12.5,
            fontWeight: 500,
            color: allThree ? 'var(--color-bg)' : 'var(--color-ink-faint)',
            background: allThree ? 'var(--color-accent)' : 'var(--color-sunken)',
            border: `0.5px solid ${allThree ? 'var(--color-accent)' : 'var(--color-rule-mid)'}`,
            cursor: allThree ? 'pointer' : 'not-allowed',
          }}
        >
          Issue cancellation →
        </button>
      </div>
    </section>
  );
}

function CancellationEndorsement() {
  const submission = useRanBerri((s) => s.submission);
  const c = useRanBerri((s) => s.cancellation);
  const bind = useRanBerri((s) => s.bind);
  if (!submission || !c.calc || !c.request) return null;
  if (c.phase !== 'committed' && c.phase !== 'sent') return null;

  const policyRef = bind.policyRef ?? '—';
  const effective = DATE_FMT.format(new Date(c.request.effectiveDate));
  const isVoid = c.calc.basis === 'void-ab-initio';

  return (
    <section className="hairline-t" style={{ padding: '22px 28px' }}>
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">cancellation endorsement</div>
        <div className="serif" style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--color-ink-mute)', marginTop: 2 }}>
          {c.endorsementRef} · effective {effective}
        </div>
      </header>
      <article
        style={{
          maxWidth: 720,
          padding: '24px 30px',
          background: '#F8F5EC',
          border: '0.5px solid var(--color-rule-mid)',
          borderRadius: 'var(--radius-card)',
          fontFamily: 'var(--font-serif)',
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--color-ink)',
          letterSpacing: '-0.005em',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <SectionLabel>cancellation endorsement</SectionLabel>
            <div className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.012em', marginTop: 4 }}>
              Greenline Recycling Ltd
            </div>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: 'var(--color-ink-mute)',
              letterSpacing: '0.06em',
              textAlign: 'right',
              lineHeight: 1.7,
            }}
          >
            <div>
              <span style={{ color: 'var(--color-ink-faint)' }}>REF:</span>{' '}
              <span style={{ color: 'var(--color-ink)' }}>{c.endorsementRef}</span>
            </div>
            <div>{policyRef}</div>
            <div>effective {effective}</div>
          </div>
        </div>
        <Divider />
        <Section label="cancellation note">
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--color-ink-soft)' }}>
            {isVoid
              ? `This policy is declared void ab initio with effect from inception. ${REASON_RULES[c.request.reasonCategory].label}. No premium movement; commission fully clawed back.`
              : `This endorsement cancels ${policyRef} with effect from ${effective}. Reason: ${REASON_RULES[c.request.reasonCategory].label}. Refund computed on ${c.calc.basis}${c.basisOverride ? ` (overridden from ${c.basisOverride.from}: "${c.basisOverride.reason}")` : ''} basis per slip wording cl.14.`}
          </p>
        </Section>
        <Section label={isVoid ? 'no return premium' : 'return premium'}>
          <div style={{ fontSize: 24, fontWeight: 500 }}>
            <span style={{ color: 'var(--color-accent)' }}>£</span>
            {c.calc.refund.toLocaleString('en-GB')}
            {!isVoid && (
              <span
                style={{ fontSize: 12, color: 'var(--color-ink-mute)', fontStyle: 'italic', marginLeft: 8 }}
              >
                · pro-rata {c.calc.daysRemaining} of {c.calc.daysInTerm} days
              </span>
            )}
          </div>
        </Section>
        <Section label="commission">
          <div style={{ fontSize: 13 }}>
            {c.calc.clawbackKind === 'full'
              ? `Full clawback: £${c.calc.commissionClawback.toLocaleString('en-GB')} recoverable from broker.`
              : c.calc.clawbackKind === 'partial'
                ? `Partial clawback: £${c.calc.commissionClawback.toLocaleString('en-GB')} recoverable from broker.`
                : 'No clawback.'}
          </div>
        </Section>
        {c.runoffClaim && (
          <Section label="run-off">
            <div style={{ fontSize: 13 }}>
              {c.runoffClaim.ref} · reserve £{c.runoffClaim.reserveAmount.toLocaleString('en-GB')}
            </div>
            <div
              style={{ fontStyle: 'italic', fontSize: 12.5, color: 'var(--color-ink-mute)', marginTop: 4 }}
            >
              {c.runoffClaim.description}
            </div>
          </Section>
        )}
        <Section label="bordereau">
          <div className="mono" style={{ fontSize: 12 }}>
            net movement: £{c.calc.bordereauNet.toLocaleString('en-GB')} · Synd 2358 · 65%
          </div>
        </Section>
        <Divider />
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            marginTop: 14,
            marginBottom: 0,
            lineHeight: 1.55,
          }}
        >
          Signed by{' '}
          <span style={{ fontStyle: 'normal', color: 'var(--color-ink)' }}>
            {c.signedBy ?? 'N. Sharma'}, Senior Underwriter
          </span>
          {c.committedAt && ` · ${TIME_FMT.format(new Date(c.committedAt))} BST`}
        </p>
      </article>
    </section>
  );
}

function SendStrip() {
  const c = useRanBerri((s) => s.cancellation);
  if (c.phase !== 'committed' && c.phase !== 'sent') return null;
  const sent = c.sentAt !== null;
  return (
    <section style={{ padding: '14px 28px 24px' }}>
      <div className="flex items-center gap-2">
        {!sent && (
          <Button variant="primary" size="sm" onClick={() => sendCancellationEndorsement('nm')}>
            Send cancellation endorsement →
          </Button>
        )}
        {sent && (
          <Pill tone="success" mono>
            CANCELLATION ENDORSEMENT SENT
          </Pill>
        )}
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 9.5,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--color-ink-faint)',
      }}
    >
      {children}
    </span>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 16 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ marginTop: 6 }}>{children}</div>
    </section>
  );
}

function Divider() {
  return <div aria-hidden style={{ marginTop: 16, height: 0.5, background: 'var(--color-rule-mid)' }} />;
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        gap: 12,
        marginBottom: 6,
        fontFamily: 'var(--font-serif)',
        fontSize: 13,
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}
