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
  assert.match(html, /Market Overview/);
  assert.match(html, /总体市场筛选/);
  assert.match(html, /单市场信息/);
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
  assert.match(page, /initial_liquidity_source/);
  assert.match(page, /yes_book_liquidity/);
  assert.match(route, /STRATEGY_DASHBOARD_API/);
});
