import { NextResponse } from "next/server";

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

  try {
    const response = await fetch(source, {
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    });
    const payload = await response.text();

    return new Response(payload, {
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
