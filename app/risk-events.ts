export function abnormalRiskEvents<T extends { type: string; severity: string }>(events: T[]): T[] {
  return events.filter(event =>
    !['normal', 'normal_quote', '正常摆单'].includes(event.type.trim().toLowerCase())
    && (event.severity === 'warn' || event.severity === 'bad'));
}
