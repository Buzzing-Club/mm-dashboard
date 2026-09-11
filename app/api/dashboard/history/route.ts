import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const realtimeUpstream = process.env.STRATEGY_DASHBOARD_API;
  const configuredUpstream = process.env.STRATEGY_DASHBOARD_HISTORY_API;
  if (!configuredUpstream && !realtimeUpstream) {
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
  const incoming = new URL(request.url);
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
    });
    const payload = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { error: "Dashboard history upstream did not return JSON", status: response.status },
        { status: 502 },
      );
    }
    return new Response(payload, {
      status: response.status,
      headers: { "content-type": contentType, "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dashboard history upstream failed" },
      { status: 502 },
    );
  }
}
