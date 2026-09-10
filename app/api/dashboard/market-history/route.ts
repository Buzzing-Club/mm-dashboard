import { NextResponse } from "next/server";
import {
  openApiConfig,
  pathWithSortedQuery,
  proxyResponse,
  signedHeaders,
  validConditionId,
} from "../openapi";

export const runtime = "nodejs";

const windows = {
  "15m": { seconds: 15 * 60, interval: "1m" },
  "1h": { seconds: 60 * 60, interval: "5m" },
  "4h": { seconds: 4 * 60 * 60, interval: "15m" },
} as const;

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const conditionId = validConditionId(incoming.searchParams.get("condition_id"));
  if (!conditionId) {
    return NextResponse.json({ error: "valid condition_id is required" }, { status: 400 });
  }

  const config = openApiConfig();
  if (!config) {
    return NextResponse.json({ error: "OpenAPI credentials are not configured" }, { status: 503 });
  }

  const requestedWindow = incoming.searchParams.get("window") as keyof typeof windows | null;
  const selectedWindow = requestedWindow && requestedWindow in windows ? requestedWindow : "1h";
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - windows[selectedWindow].seconds;
  const path = `/openapi/v1/dashboard/markets/${conditionId}/history`;
  const pathQuery = pathWithSortedQuery(path, {
    end_time: String(endTime),
    include_pnl: "true",
    interval: windows[selectedWindow].interval,
    start_time: String(startTime),
  });

  try {
    const response = await fetch(`${config.baseUrl}${pathQuery}`, {
      headers: signedHeaders("GET", pathQuery, config.apiKey, config.apiSecret),
      cache: "no-store",
    });
    return proxyResponse(response, await response.text());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OpenAPI request failed" },
      { status: 502 },
    );
  }
}
