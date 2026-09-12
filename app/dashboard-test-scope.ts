type ScopedItem = { identity?: { condition_id?: string } };

// This is a temporary display filter, not an authorization boundary.
export function scopeDashboardMarkets<T extends { items?: ScopedItem[] }>(payload: T, configured?: string): T & { display_scope?: string } {
  if (!configured?.trim()) return payload;
  const ids = configured.split(',').map(id => id.trim().toLowerCase());
  if (ids.some(id => !/^0x[a-f0-9]{64}$/.test(id))) {
    throw new Error('Invalid DASHBOARD_TEST_CONDITION_IDS');
  }
  const allowed = new Set(ids);
  return {
    ...payload,
    items: (payload.items ?? []).filter(item => allowed.has(item.identity?.condition_id?.toLowerCase() ?? '')),
    display_scope: 'PREVIEW QA',
  };
}
