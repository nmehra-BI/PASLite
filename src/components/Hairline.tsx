type Props = {
  orientation?: 'horizontal' | 'vertical';
  tone?: 'soft' | 'mid';
  className?: string;
};

export function Hairline({ orientation = 'horizontal', tone = 'soft', className = '' }: Props) {
  const color = tone === 'mid' ? 'var(--color-rule-mid)' : 'var(--color-rule)';
  const style =
    orientation === 'horizontal'
      ? { height: 0.5, background: color, width: '100%' }
      : { width: 0.5, background: color, height: '100%' };
  return <div role="separator" aria-orientation={orientation} className={className} style={style} />;
}
