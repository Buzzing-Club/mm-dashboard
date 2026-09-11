"use client";

import { useEffect, useState } from "react";
import { accountPnlSnapshot, accountPnlTotals, type AccountPnlSnapshot } from "./review-account-pnl-data";

const money = (value: number) => `${value < 0 ? "-" : ""}${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ReviewAccountPnl({ markets, refreshKey, enabled }: { markets: Array<{ id: string; event: string }>; refreshKey: number; enabled: boolean }) {
  const idsKey = JSON.stringify([...new Set(markets.map(row => row.id.toLowerCase()).filter(id => /^0x[a-f0-9]{64}$/.test(id)))].sort());
  const [result, setResult] = useState<{ key: string; snapshot: AccountPnlSnapshot | null; error: string } | null>(null);
  const key = `${idsKey}:${refreshKey}`;
  useEffect(() => {
    if (!enabled) return;
    const ids = JSON.parse(idsKey) as string[];
    const controller = new AbortController();
    async function load() {
      const payloads: unknown[] = [];
      let failed = false;
      for (let offset = 0; offset < ids.length; offset += 100) {
        try {
          const response = await fetch("/api/dashboard/market-realtime-batch", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ condition_ids: ids.slice(offset, offset + 100), window: "1h" }),
            cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
          });
          if (!response.ok) throw new Error("backend unavailable");
          payloads.push(await response.json());
        } catch { failed = true; }
        if (controller.signal.aborted) return;
      }
      if (!controller.signal.aborted) setResult({ key, snapshot: accountPnlSnapshot(ids, payloads, new Date().toISOString()), error: failed ? "部分市场接口请求失败" : "" });
    }
    void load();
    return () => controller.abort();
  }, [enabled, idsKey, key]);
  if (!enabled) return null;
  const current = result?.key === key ? result : null;
  const snapshot = current?.snapshot;
  const totals = snapshot ? accountPnlTotals(snapshot) : null;
  const names = new Map(markets.map(row => [row.id.toLowerCase(), row.event]));
  return <div className="review-account-pnl">
    <h3>账户 PnL · 当前及历史市场</h3>
    <p className="review-data-coverage" title="当前后端 API Key 账户；按 condition_id 去重后汇总，包含看板已加载的历史市场。不是所有用户收益，也不保证覆盖账户在看板外的其他市场。各批次为本次读取的最新值，不是原子快照。">
      {snapshot ? `${snapshot.rows.length} / ${snapshot.expected} 个市场已覆盖${snapshot.missing.length ? " · 部分汇总" : ""} · USDB · ${new Date(snapshot.observedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })} (UTC+8)` : "正在读取账户 PnL"}
      {current?.error ? ` · ${current.error}` : ""}
    </p>
    <div className="review-pnl-summary">
      {([ ["已实现 PnL", "realized"], ["未实现 PnL", "unrealized"], [snapshot?.missing.length ? "已覆盖市场合计" : "总 PnL", "total"] ] as const).map(([label, field]) => <div key={field}><span title="后端账户口径；已实现 + 未实现 = 总 PnL。与下方尚未接入的点差/敞口归因不同。">{label}</span><strong className={totals && totals[field] < 0 ? "negative" : "positive"}>{totals ? money(totals[field]) : "待接入"}</strong></div>)}
    </div>
    <div className="review-seven-table-wrap"><table className="review-seven-table"><thead><tr><th>市场</th><th>已实现 PnL</th><th>未实现 PnL</th><th>总 PnL</th></tr></thead><tbody>
      {[...(snapshot?.rows ?? [])].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)).map(row => <tr key={row.conditionId}><td>{names.get(row.conditionId) ?? row.conditionId}</td><td>{money(row.realized)}</td><td>{money(row.unrealized)}</td><td className={row.total < 0 ? "negative" : "positive"}>{money(row.total)}</td></tr>)}
    </tbody></table></div>
    {!!snapshot?.missing.length && <details className="review-data-coverage"><summary>未覆盖市场（{snapshot.missing.length}）</summary>{snapshot.missing.map(id => <p key={id}>{names.get(id) ?? id}</p>)}</details>}
  </div>;
}
