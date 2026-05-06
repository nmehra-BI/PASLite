export function formatGBP(n: number): string {
  const abs = Math.abs(n);
  const formatted = `£${abs.toLocaleString('en-GB')}`;
  return n < 0 ? `−${formatted}` : formatted;
}

export function formatGBPSigned(n: number): string {
  if (n === 0) return formatGBP(0);
  if (n < 0) return `−${formatGBP(Math.abs(n))}`;
  return `+${formatGBP(n)}`;
}

export function formatPercent(n: number, decimals = 2): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function formatPercentSigned(n: number, decimals = 1): string {
  const v = (n * 100).toFixed(decimals);
  if (n > 0) return `+${v}%`;
  if (n < 0) return `${v}%`; // already has '-'
  return `${v}%`;
}

export function formatBP(n: number): string {
  return `${(n * 10_000).toFixed(0)} bp`;
}
