import { createHash, createHmac, randomBytes } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function pathWithSortedQuery(path: string, query: Record<string, string | undefined>) {
  const pairs = Object.entries(query)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .sort(([left], [right]) => left.localeCompare(right));
  const encoded = new URLSearchParams(pairs).toString();
  return encoded ? `${path}?${encoded}` : path;
}

function signedHeaders(method: string, pathQuery: string, apiKey: string, apiSecret: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const bodyHash = createHash("sha256").update("").digest("hex");
  const canonical = [method.toUpperCase(), pathQuery, timestamp, nonce, bodyHash].join("\n");
  const signature = createHmac("sha256", apiSecret).update(canonical).digest("hex");

  return {
    accept: "application/json",
    "User-Agent": "mm-dashboard/1.0",
    "x-bz-api-key": apiKey,
    "x-bz-signature": signature,
    "x-bz-timestamp": timestamp,
    "x-bz-nonce": nonce,
  };
}

function validWindow(value: string | null) {
  if (!value) return "1h";
  if (!/^\d+[mh]$/.test(value)) return "1h";
  const amount = Number(value.slice(0, -1));
  const unit = value.slice(-1);
  const minutes = unit === "h" ? amount * 60 : amount;
  return minutes >= 1 && minutes <= 24 * 60 ? value : "1h";
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const conditionId = incoming.searchParams.get("condition_id")?.trim();
  if (!conditionId || !/^0x[a-f0-9]{64}$/i.test(conditionId)) {
    return NextResponse.json({ error: "valid condition_id is required" }, { status: 400 });
  }

  const baseUrl = process.env.OPENAPI_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.OPENAPI_API_KEY;
  const apiSecret = process.env.OPENAPI_API_SECRET;
  if (!baseUrl || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "OpenAPI credentials are not configured" }, { status: 503 });
  }

  const path = `/openapi/v1/dashboard/markets/${conditionId}/realtime`;
  const pathQuery = pathWithSortedQuery(path, {
    include_slippage_distribution: "true",
    include_trades: "false",
    window: validWindow(incoming.searchParams.get("window")),
  });

  try {
    const response = await fetch(`${baseUrl}${pathQuery}`, {
      headers: signedHeaders("GET", pathQuery, apiKey, apiSecret),
      cache: "no-store",
    });
    const payload = await response.text();
    const contentType = response.headers.get("content-type") ?? "application/json";

    return new Response(payload, {
      status: response.status,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OpenAPI request failed" },
      { status: 502 },
    );
  }
}
