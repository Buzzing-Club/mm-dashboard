import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function request(path, options = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      ...options,
      headers: { accept: "text/html,application/json" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the market-making dashboard shell", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Market Making Realtime Dashboard<\/title>/i);
  assert.match(html, /实时市场看板/);
  assert.match(html, /做市 Review/);
  assert.match(html, /Market Overview/);
  assert.match(html, /总体市场筛选/);
  assert.match(html, /单市场信息/);
  assert.match(html, /Cross-market Ranking/);
  assert.match(html, /data-source-loading/);
});

test("keeps the dashboard API proxy explicit when upstream is missing", async () => {
  const response = await request("/api/dashboard/realtime");
  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);

  const payload = await response.json();
  assert.equal(payload.error, "STRATEGY_DASHBOARD_API is not configured");
});

test("validates and exposes the strategy Review proxy", async () => {
  const invalid = await request("/api/dashboard/review?condition_id=invalid");
  assert.equal(invalid.status, 400);

  const conditionId = `0x${"b".repeat(64)}`;
  const response = await request(`/api/dashboard/review?condition_id=${conditionId}`);
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.error, "Strategy dashboard Review API is not configured");
});

test("keeps OpenAPI history and batch proxies protected by server credentials", async () => {
  const conditionId = `0x${"a".repeat(64)}`;
  const [historyResponse, batchResponse] = await Promise.all([
    request(`/api/dashboard/market-history?condition_id=${conditionId}&window=1h`),
    request("/api/dashboard/market-realtime-batch", {
      method: "POST",
      body: JSON.stringify({ condition_ids: [conditionId], window: "1h" }),
    }),
  ]);

  assert.equal(historyResponse.status, 503);
  assert.equal(batchResponse.status, 503);
});

test("keeps dashboard code wired to the strategy and backend contracts", async () => {
  const [page, route, reviewRoute, historyRoute, batchRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/realtime/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/market-history/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/market-realtime-batch/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /mm-dashboard-realtime\.v1/);
  assert.match(page, /mapDashboardPayload/);
  assert.match(page, /actual_pairs_per_hour/);
  assert.match(page, /tier1_actual_pairs_per_hour/);
  assert.match(page, /mid_actual_pairs_per_hour/);
  assert.match(page, /active_pairs_by_kind/);
  assert.match(page, /initial_liquidity_source/);
  assert.match(page, /create_time/);
  assert.match(page, /configured_frequency/);
  assert.match(page, /yes_book_liquidity/);
  assert.match(page, /label_zh/);
  assert.match(page, /experience_quality/);
  assert.match(page, /single_sided_empty/);
  assert.match(page, /double_sided_empty/);
  assert.match(page, /l1_distance_exceeded/);
  assert.match(page, /slippage_distribution_by_notional/);
  assert.match(page, /MarketOverviewSummary/);
  assert.match(page, /riskStatusFilter/);
  assert.match(page, /categoryMarkets/);
  assert.match(page, /statusScopeMarkets=\{categoryMarkets\}/);
  assert.match(page, /classifyDashboardMarket/);
  assert.match(page, /marketCategoryRules/);
  assert.match(page, /当前没有该类别市场/);
  assert.match(page, /categoryCounts\[option\.id\]/);
  assert.match(page, /allMarkets=\{markets\}/);
  assert.match(page, /setRiskStatusFilter\(null\)/);
  assert.match(page, /aria-pressed=\{activeStatus === typedStatus\}/);
  assert.match(page, /市场类别与状态筛选/);
  assert.match(page, /全部状态/);
  assert.doesNotMatch(page, /id: "attention", label: "异常"/);
  assert.match(page, /ExperienceIncidentTimeline/);
  assert.match(page, /ReviewDashboard/);
  assert.match(page, /搜索复盘市场/);
  assert.match(page, /按市场类别筛选复盘市场/);
  assert.match(page, /reviewMarketResults/);
  assert.doesNotMatch(page, /className="review-market-select"/);
  assert.match(page, /市场活跃度与成交漏斗/);
  assert.match(page, /订单流毒性/);
  assert.match(page, /盈亏归因/);
  assert.match(page, /盘前 · 接管与收敛/);
  assert.match(page, /启动收敛落点分布/);
  assert.match(page, /报价活动 × 尾盘距离/);
  assert.match(page, /Planned 决策/);
  assert.match(page, /尾盘 \/ 盘后 · 退出流转与库存退出/);
  assert.match(page, /waiting_result_reduce_only_sell/);
  assert.match(page, /mm-dashboard-review\.v1/);
  assert.match(page, /REVIEW API/);
  assert.match(page, /策略 Review API · 持久决策投影/);
  assert.match(page, /市场漏斗待接入/);
  assert.doesNotMatch(page, /开盘定价合理性/);
  assert.doesNotMatch(page, /MAE100/);
  assert.match(page, /reviewDefinitionDescriptions/);
  assert.doesNotMatch(page, /Review 数据准备度/);
  assert.match(page, /成交额待接入/);
  assert.match(page, /gross_volume_cumulative/);
  assert.match(page, /net_volume_cumulative/);
  assert.match(page, /avg_trade_impact_5s/);
  assert.match(page, /Gross \/ Net Volume \/ PnL/);
  assert.match(page, /无样本区间保留为空/);
  assert.match(page, /market-realtime-batch/);
  assert.match(page, /market-history/);
  assert.match(page, /等待后端提供真实成交滑点分布/);
  assert.match(page, /等待后端提供成交时刻基准价与滑点时序/);
  assert.match(route, /STRATEGY_DASHBOARD_API/);
  assert.match(route, /CF_ACCESS_CLIENT_ID/);
  assert.match(route, /CF-Access-Client-Secret/);
  assert.match(route, /Dashboard upstream did not return JSON/);
  assert.match(reviewRoute, /STRATEGY_DASHBOARD_REVIEW_API/);
  assert.match(reviewRoute, /\/api\/dashboard\/review/);
  assert.match(reviewRoute, /condition_id must be a 32-byte hex value/);
  assert.match(historyRoute, /include_pnl/);
  assert.match(historyRoute, /\/history/);
  assert.match(batchRoute, /include_slippage_distribution/);
  assert.match(batchRoute, /condition_ids/);
});
