import { NextResponse } from "next/server";
import { buildReviewFacts, map, rows, type FactSource, type ReviewFacts } from "../../../review-facts";
import { validConditionId } from "../openapi";

export const runtime = "nodejs";
let cached: { key: string; expires: number; data: ReviewFacts } | undefined;
let pending: { key: string; promise: Promise<ReviewFacts> } | undefined;

async function loadSources(source: URL, headers: Headers): Promise<ReviewFacts> {
  const paths = { jobs: "/api/jobs", catalog: "/api/catalog", decisions: "/api/strategy-decisions", actions: "/api/order-actions", fills: "/api/fills" };
  const entries = await Promise.all(Object.entries(paths).map(async ([name, path]) => {
    const url = new URL(path, source);
    const limit = 1000;
    if (name !== "jobs") url.searchParams.set("limit", String(limit));
    try {
      const response = await fetch(url, { headers, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("upstream failed");
      const payload = map(await response.json());
      if (!Array.isArray(payload.items)) throw new Error("invalid upstream schema");
      const items = rows(payload.items);
      return [name, { rows: items, available: true, capped: name !== "jobs" && items.length >= limit } satisfies FactSource];
    } catch {
      return [name, { rows: [], available: false, capped: false } satisfies FactSource];
    }
  }));
  return Object.fromEntries(entries) as ReviewFacts;
}

export async function GET(request: Request) {
  const conditionId = validConditionId(new URL(request.url).searchParams.get("condition_id"));
  if (!conditionId) return NextResponse.json({ error: "valid condition_id is required" }, { status: 400 });
  if (!process.env.STRATEGY_DASHBOARD_API) return NextResponse.json({ error: "Strategy API is not configured" }, { status: 503 });
  try {
    const source = new URL(process.env.STRATEGY_DASHBOARD_API);
    const headers = new Headers({ accept: "application/json" });
    const id = process.env.CF_ACCESS_CLIENT_ID ?? process.env.CLOUDFLARE_ACCESS_CLIENT_ID;
    const secret = process.env.CF_ACCESS_CLIENT_SECRET ?? process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
    if (id && secret) { headers.set("CF-Access-Client-Id", id); headers.set("CF-Access-Client-Secret", secret); }
    const key = `${source.origin}|${id ?? ""}`;
    if (!cached || cached.key !== key || cached.expires < Date.now()) {
      if (!pending || pending.key !== key) pending = { key, promise: loadSources(source, headers) };
      const current = pending;
      const data = await current.promise;
      cached = { key, expires: Date.now() + 60_000, data };
      if (pending === current) pending = undefined;
    }
    if (!cached.data.jobs.available || !cached.data.catalog.available) return NextResponse.json({ error: "Review market sources unavailable" }, { status: 502 });
    const payload = buildReviewFacts(conditionId, cached.data, Date.now());
    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Review facts unavailable" }, { status: 502 });
  }
}
