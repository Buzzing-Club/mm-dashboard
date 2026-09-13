import { NextResponse } from "next/server";
import { scopeDashboardMarkets } from "../../../dashboard-test-scope";
import { archivedStrategy, listMarketArchives, marketArchiveDirectory } from '../../../market-archive-store.ts';

export const runtime = "nodejs";

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  let saved: Awaited<ReturnType<typeof listMarketArchives>> = [];
  try { saved = await listMarketArchives(marketArchiveDirectory()); }
  catch (error) { console.error('Archive disk read failed', String(error)); }
  const storedResponse = () => NextResponse.json(scopeDashboardMarkets({ contract_version: 'mm-dashboard-history.v1', generated_at: Date.now() / 1000,
    items: saved.filter(item => !incoming.searchParams.get('condition_id') || item.id === incoming.searchParams.get('condition_id')).map(archivedStrategy) }, process.env.DASHBOARD_TEST_CONDITION_IDS));
  const realtimeUpstream = process.env.STRATEGY_DASHBOARD_API;
  const configuredUpstream = process.env.STRATEGY_DASHBOARD_HISTORY_API;
  if (!configuredUpstream && !realtimeUpstream) {
    if (saved.length) return storedResponse();
    return NextResponse.json(
      { error: "STRATEGY_DASHBOARD_API is not configured" },
      { status: 503 },
    );
  }

  const source = configuredUpstream
    ? new URL(configuredUpstream)
    : new URL(realtimeUpstream as string);
  if (!configuredUpstream) {
    const derivedPath = source.pathname.replace(/\/realtime\/?$/, "/history");
    source.pathname = derivedPath === source.pathname ? "/api/dashboard/history" : derivedPath;
  }
  for (const key of ["condition_id", "limit"]) {
    const value = incoming.searchParams.get(key);
    if (value) source.searchParams.set(key, value);
  }

  const headers = new Headers({ accept: "application/json" });
  const cfAccessClientId = process.env.CF_ACCESS_CLIENT_ID ?? process.env.CLOUDFLARE_ACCESS_CLIENT_ID;
  const cfAccessClientSecret = process.env.CF_ACCESS_CLIENT_SECRET ?? process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
  if (cfAccessClientId && cfAccessClientSecret) {
    headers.set("CF-Access-Client-Id", cfAccessClientId);
    headers.set("CF-Access-Client-Secret", cfAccessClientSecret);
  }

  try {
    const response = await fetch(source, {
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      if (saved.length) return storedResponse();
      return NextResponse.json(
        { error: "Dashboard history upstream did not return JSON", status: response.status },
        { status: 502 },
      );
    }
    if (!response.ok && saved.length) return storedResponse();
    let body = payload;
    if (response.ok) {
      const parsed = JSON.parse(payload);
      const merged = new Map<string, unknown>((parsed.items ?? []).map((item: {identity?: {condition_id?: string}}) => [item.identity?.condition_id ?? '', item]));
      for (const item of saved) if (!incoming.searchParams.get('condition_id') || item.id === incoming.searchParams.get('condition_id')) merged.set(item.id, archivedStrategy(item));
      body = JSON.stringify(scopeDashboardMarkets({ ...parsed, items: [...merged.values()] }, process.env.DASHBOARD_TEST_CONDITION_IDS));
    }
    return new Response(body, {
      status: response.status,
      headers: { "content-type": contentType, "cache-control": "no-store" },
    });
  } catch (error) {
    if (saved.length) return storedResponse();
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dashboard history upstream failed" },
      { status: 502 },
    );
  }
}
