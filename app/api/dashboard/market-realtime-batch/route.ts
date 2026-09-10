import { NextResponse } from "next/server";
import {
  openApiConfig,
  proxyResponse,
  signedHeaders,
  validConditionId,
} from "../openapi";

export const runtime = "nodejs";

const windows = new Set(["15m", "1h", "4h"]);

export async function POST(request: Request) {
  let input: { condition_ids?: unknown; window?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "valid JSON body is required" }, { status: 400 });
  }

  const rawConditionIds = Array.isArray(input.condition_ids) ? input.condition_ids : [];
  const conditionIds = rawConditionIds.length
    ? rawConditionIds.map((value) => validConditionId(String(value))).filter((value): value is string => Boolean(value))
    : [];
  if (!conditionIds.length || conditionIds.length > 100 || conditionIds.length !== rawConditionIds.length) {
    return NextResponse.json({ error: "condition_ids must contain 1 to 100 valid ids" }, { status: 400 });
  }

  const config = openApiConfig();
  if (!config) {
    return NextResponse.json({ error: "OpenAPI credentials are not configured" }, { status: 503 });
  }

  const path = "/openapi/v1/dashboard/markets/realtime/batch";
  const body = JSON.stringify({
    condition_ids: conditionIds,
    include_slippage_distribution: false,
    window: typeof input.window === "string" && windows.has(input.window) ? input.window : "1h",
  });

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        ...signedHeaders("POST", path, config.apiKey, config.apiSecret, body),
        "content-type": "application/json",
      },
      body,
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
