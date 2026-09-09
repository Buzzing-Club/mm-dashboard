import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function request(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
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

test("keeps dashboard code wired to the strategy contract", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/realtime/route.ts", import.meta.url), "utf8"),
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
  assert.match(page, /ExperienceIncidentTimeline/);
  assert.match(page, /ReviewDashboard/);
  assert.match(page, /市场活跃度与成交漏斗/);
  assert.match(page, /订单流毒性/);
  assert.match(page, /盈亏归因/);
  assert.match(page, /开盘定价准确性/);
  assert.match(page, /MarketLifecycleMode 历史/);
  assert.match(page, /成交额待接入/);
  assert.match(page, /等待后端提供按市场、按时间窗口聚合的成交额 \/ PnL \/ Wash 时序/);
  assert.match(page, /等待后端提供真实成交滑点分布/);
  assert.match(page, /等待后端提供成交时刻基准价与滑点时序/);
  assert.match(route, /STRATEGY_DASHBOARD_API/);
  assert.match(route, /CF_ACCESS_CLIENT_ID/);
  assert.match(route, /CF-Access-Client-Secret/);
  assert.match(route, /Dashboard upstream did not return JSON/);
});
