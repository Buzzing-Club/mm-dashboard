export type AccountPnlRow = { conditionId: string; realized: number; unrealized: number; total: number };
export type AccountPnlSnapshot = { rows: AccountPnlRow[]; expected: number; missing: string[]; observedAt: string };

function amount(value: unknown): number | null {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n / 1_000_000 : null;
}

export function accountPnlSnapshot(conditionIds: string[], payloads: unknown[], observedAt: string): AccountPnlSnapshot {
  const expected = [...new Set(conditionIds.map(id => id.toLowerCase()))];
  const results = new Map<string, AccountPnlRow>();
  for (const payload of payloads) {
    if (!payload || typeof payload !== "object") continue;
    const root = payload as { code?: number; data?: { amount_unit?: string; items?: Array<{ condition_id?: string; pnl?: Record<string, unknown> }> } };
    if (root.code !== 0 || (root.data?.amount_unit && root.data.amount_unit !== "usdb_raw6")) continue;
    if (!Array.isArray(root.data?.items)) continue;
    for (const item of root.data.items) {
      if (!item || typeof item !== "object") continue;
      const id = typeof item.condition_id === "string" ? item.condition_id.toLowerCase() : undefined;
      if (!id || !expected.includes(id) || !item.pnl) continue;
      const realized = amount(item.pnl.realized_pnl), unrealized = amount(item.pnl.unrealized_pnl), total = amount(item.pnl.current_pnl);
      if (realized === null || unrealized === null || total === null) continue;
      results.set(id, { conditionId: id, realized, unrealized, total });
    }
  }
  return { rows: [...results.values()], expected: expected.length, missing: expected.filter(id => !results.has(id)), observedAt };
}

export function accountPnlTotals(snapshot: AccountPnlSnapshot) {
  if (!snapshot.rows.length) return null;
  return snapshot.rows.reduce((sum, row) => ({ realized: sum.realized + row.realized, unrealized: sum.unrealized + row.unrealized, total: sum.total + row.total }), { realized: 0, unrealized: 0, total: 0 });
}
