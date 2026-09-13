const decimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const significant = new Intl.NumberFormat('en-US', { minimumSignificantDigits: 2, maximumSignificantDigits: 2 });

export function formatReviewNumber(value: number): string {
  if (!Number.isFinite(value)) return '--';
  if (value === 0) return decimals.format(0);
  return (Math.abs(value) < 0.01 ? significant : decimals).format(value);
}

export function formatReviewTooltip(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatReviewTooltip).join(' ~ ');
  return typeof value === 'number' ? formatReviewNumber(value) : String(value ?? '--');
}
