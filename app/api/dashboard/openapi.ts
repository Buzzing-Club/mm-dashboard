import { createHash, createHmac, randomBytes } from "crypto";

export function openApiConfig() {
  const baseUrl = process.env.OPENAPI_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.OPENAPI_API_KEY;
  const apiSecret = process.env.OPENAPI_API_SECRET;
  return baseUrl && apiKey && apiSecret ? { baseUrl, apiKey, apiSecret } : null;
}

export function pathWithSortedQuery(path: string, query: Record<string, string | undefined>) {
  const pairs = Object.entries(query)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .sort(([left], [right]) => left.localeCompare(right));
  const encoded = new URLSearchParams(pairs).toString();
  return encoded ? `${path}?${encoded}` : path;
}

export function signedHeaders(
  method: string,
  pathQuery: string,
  apiKey: string,
  apiSecret: string,
  body = "",
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const bodyHash = createHash("sha256").update(body).digest("hex");
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

export function validConditionId(value: string | null | undefined) {
  const conditionId = value?.trim();
  return conditionId && /^0x[a-f0-9]{64}$/i.test(conditionId) ? conditionId : null;
}

export function proxyResponse(response: Response, payload: string) {
  return new Response(payload, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}
