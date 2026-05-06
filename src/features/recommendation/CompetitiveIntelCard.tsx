import type { CompetitorProfile } from '@/lib/fixtures';

const TONE: Record<CompetitorProfile['estimatedAggressiveness'], { label: string; color: string }> = {
  sharp: { label: 'sharp', color: 'var(--color-warn)' },
  disciplined: { label: 'disciplined', color: 'var(--color-info)' },
  unknown: { label: 'unknown', color: 'var(--color-ink-mute)' },
};

export function CompetitiveIntelCard({ profile }: { profile: CompetitorProfile }) {
  const tone = TONE[profile.estimatedAggressiveness];
  const range =
    profile.typicalDiscount !== null
      ? `${(profile.typicalDiscount.min * 100).toFixed(0)}% to ${(profile.typicalDiscount.max * 100).toFixed(0)}%`
      : '—';
  return (
    <div
      className="hairline"
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-button)',
        background: 'var(--color-surface)',
      }}
    >
      <div className="flex items-baseline gap-3">
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-ink)',
            letterSpacing: '-0.005em',
          }}
        >
          {profile.name}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: tone.color,
          }}
        >
          {tone.label}
        </span>
        <span
          className="mono"
          style={{ fontSize: 10.5, color: 'var(--color-ink-mute)', letterSpacing: '0.04em' }}
        >
          discount {range}
        </span>
        <span style={{ flex: 1 }} />
        <span
          className="mono"
          style={{ fontSize: 10.5, color: 'var(--color-ink-mute)', letterSpacing: '0.04em' }}
        >
          {profile.losses} losses
        </span>
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12,
          color: 'var(--color-ink-mute)',
          marginTop: 4,
          lineHeight: 1.5,
        }}
      >
        {profile.notes}
      </div>
    </div>
  );
}
