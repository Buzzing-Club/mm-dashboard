import { NextResponse } from "next/server";
import { scopeDashboardMarkets } from "../../../dashboard-test-scope";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const upstream = process.env.STRATEGY_DASHBOARD_API;
  if (!upstream) {
    return NextResponse.json(
      {
        error: "STRATEGY_DASHBOARD_API is not configured",
      },
      { status: 503 },
    );
  }

  const source = new URL(upstream);
  const incoming = new URL(request.url);
  const conditionId = incoming.searchParams.get("condition_id");
  if (conditionId) {
    source.searchParams.set("condition_id", conditionId);
  }

  const headers = new Headers({
    accept: "application/json",
  });
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
        {
          error: "Dashboard upstream did not return JSON",
          status: response.status,
          location: response.headers.get("location"),
        },
        { status: 502 },
      );
    }

    const body = response.ok ? JSON.stringify(scopeDashboardMarkets(JSON.parse(payload), process.env.DASHBOARD_TEST_CONDITION_IDS)) : payload;
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Dashboard upstream failed",
      },
      { status: 502 },
    );
  }
}
