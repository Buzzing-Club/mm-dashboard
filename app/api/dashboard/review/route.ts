import { NextResponse } from "next/server";

export const runtime = "nodejs";

function reviewEndpoint() {
  const configured = process.env.STRATEGY_DASHBOARD_REVIEW_API;
  if (configured) return new URL(configured);

  const realtime = process.env.STRATEGY_DASHBOARD_API;
  if (!realtime) return null;
  const source = new URL(realtime);
  source.pathname = source.pathname.replace(
    /\/api\/dashboard\/realtime\/?$/,
    "/api/dashboard/review",
  );
  source.search = "";
  return source;
}

type JsonMap = Record<string, unknown>;

function asMap(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonMap : {};
}

function asRows(value: unknown): JsonMap[] {
  const rows = asMap(value).items;
  return Array.isArray(rows) ? rows.map(asMap) : [];
}

function numeric(value: unknown): number | null {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

function epoch(value: unknown): number | null {
  const direct = numeric(value);
  if (direct !== null) return direct;
  const parsed = typeof value === "string" ? Date.parse(value) / 1000 : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function lifecycleMode(row: JsonMap) {
  const strategyStatus = asMap(asMap(row.risk_state).strategy_status);
  return String(strategyStatus.lifecycle_mode ?? strategyStatus.kind ?? "").toLowerCase();
}

function tteBucket(value: number) {
  if (value <= 0) return "expired";
  if (value > 3600) return "gt_60m";
  if (value > 1800) return "60m_30m";
  if (value > 600) return "30m_10m";
  if (value > 300) return "10m_5m";
  return "lt_5m";
}

async function fetchJson(source: URL, path: string, headers: Headers) {
  const target = new URL(source);
  target.pathname = path;
  target.search = "";
  const limit = path === "/api/catalog" ? "2000" : path === "/api/jobs" ? null : "1000";
  if (limit) target.searchParams.set("limit", limit);
  const response = await fetch(target, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function buildCompatibilityReview(source: URL, conditionId: string, headers: Headers) {
  const [decisionPayload, actionPayload, catalogPayload, jobPayload] = await Promise.all([
    fetchJson(source, "/api/strategy-decisions", headers),
    fetchJson(source, "/api/order-actions", headers),
    fetchJson(source, "/api/catalog", headers),
    fetchJson(source, "/api/jobs", headers),
  ]);
  const decisions = asRows(decisionPayload)
    .filter((row) => row.condition_id === conditionId)
    .sort((left, right) => (epoch(left.created_at) ?? 0) - (epoch(right.created_at) ?? 0));
  const actions = asRows(actionPayload).filter((row) => {
    const request = asMap(row.request);
    return row.condition_id === conditionId
      && row.action === "place_result"
      && request.audit_reason === "waiting_result_reduce_only_sell";
  });
  const market = asRows(catalogPayload).find((row) => row.condition_id === conditionId) ?? {};
  const jobs = asRows(jobPayload).filter((row) => row.condition_id === conditionId);
  const job = jobs.find((row) => row.job_type === "market_maker" && row.enabled === true)
    ?? jobs.find((row) => row.job_type === "market_maker")
    ?? jobs[0]
    ?? {};
  if (!Object.keys(market).length && !Object.keys(job).length) return null;

  const startTime = (epoch(market.start_time) ?? 0) > 0 ? epoch(market.start_time) : epoch(market.create_time);
  const endTime = (epoch(market.end_time) ?? 0) > 0 ? epoch(market.end_time) : null;
  const params = asMap(asMap(job.config).params);
  const taperCurve = Array.isArray(params.expiry_taper_curve) ? params.expiry_taper_curve : [];
  const curveMinutes = numeric(asMap(taperCurve[0]).minutes) ?? numeric(params.expiry_taper_start_minutes) ?? 60;
  const scaleFloor = Math.min(1, Math.max(0.000001, numeric(params.lifecycle_duration_scale_floor) ?? 0.1));
  const scalingEnabled = params.lifecycle_duration_scaling_enabled !== false;
  const duration = startTime !== null && endTime !== null ? endTime - startTime : null;
  const scale = scalingEnabled && duration !== null && duration > 0
    ? Math.min(1, Math.max(scaleFloor, duration / Math.max(1, curveMinutes * 60)))
    : 1;
  const generatedAt = Date.now() / 1000;
  const rawTte = endTime === null ? null : endTime - generatedAt;
  const convergence: Record<string, number> = {};
  const transitions: Record<string, number> = {
    waiting_result: 0,
    result_tail_yes: 0,
    result_tail_no: 0,
    disputed_paused: 0,
    final: 0,
  };
  const buckets = ["gt_60m", "60m_30m", "30m_10m", "10m_5m", "lt_5m", "expired"];
  const observations = Object.fromEntries(buckets.map((bucket) => [bucket, { bucket, normal: 0, waiting_result: 0, result_tail: 0 }]));
  let previousMode = "pending_authority";
  let planned = 0;
  let blocked = 0;
  let settlementRisk: number | null = null;

  for (const row of decisions) {
    const mode = lifecycleMode(row);
    if (mode && mode !== previousMode) {
      if (previousMode === "pending_authority" && mode !== "pending_authority") {
        convergence[mode] = (convergence[mode] ?? 0) + 1;
      } else if (mode in transitions) {
        transitions[mode] += 1;
      }
      previousMode = mode;
    }
    const observedAt = epoch(row.created_at);
    if (observedAt !== null && endTime !== null) {
      const bucket = tteBucket((endTime - observedAt) / scale);
      const projectedMode = mode === "normal" ? "normal" : mode === "waiting_result" ? "waiting_result" : mode.startsWith("result_tail_") ? "result_tail" : null;
      if (projectedMode) observations[bucket][projectedMode] += 1;
    }
    if (Array.isArray(row.planned_orders) && row.planned_orders.length) planned += 1;
    if (Object.keys(asMap(asMap(row.risk_state).quote_block)).length) blocked += 1;
    const latestRisk = numeric(asMap(asMap(asMap(row.risk_state).strategy_status).dynamic_inventory).settlement_risk_factor);
    if (latestRisk !== null) settlementRisk = latestRisk;
  }
  const firstObserved = epoch(decisions[0]?.created_at) ?? generatedAt;
  const lastObserved = epoch(decisions.at(-1)?.created_at) ?? generatedAt;
  const observedMinutes = Math.max(1, (lastObserved - firstObserved) / 60);
  const expiredRows = decisions.filter((row) => lifecycleMode(row) === "waiting_result" && endTime !== null && (epoch(row.created_at) ?? 0) >= endTime);
  const expiredMinutes = endTime !== null && expiredRows.length ? Math.max(1, ((epoch(expiredRows.at(-1)?.created_at) ?? generatedAt) - endTime) / 60) : null;
  const yesPositionId = String(market.yes_position_id ?? "");
  const noPositionId = String(market.no_position_id ?? "");
  const audits = actions.map((row) => {
    const request = asMap(row.request);
    const result = asMap(row.result);
    const positionId = String(request.position_id ?? "");
    return {
      action_id: row.action_id,
      time: typeof row.created_at === "string" ? row.created_at : null,
      outcome: positionId && positionId === yesPositionId ? "YES" : positionId && positionId === noPositionId ? "NO" : "UNKNOWN",
      side: String(request.side ?? "").toUpperCase(),
      price: numeric(request.price),
      quantity: numeric(request.qty),
      status: result.ok === true ? "accepted" : result.uncertain === true ? "uncertain" : "rejected",
    };
  });
  const normalTransitions = convergence.normal ?? 0;
  const convergenceTotal = Object.values(convergence).reduce((total, value) => total + value, 0);
  const reduceOnlyQuantity = audits.reduce((total, row) => total + (row.quantity ?? 0), 0);

  return {
    contract_version: "mm-dashboard-review.v1",
    generated_at: generatedAt,
    condition_id: conditionId,
    scope: "single_market",
    source: { precision: "dashboard_compat_projection", note: "Temporary projection from existing strategy read APIs." },
    coverage: { decision_count: decisions.length, reduce_only_audit_count: actions.length },
    premarket: {
      convergence_by_mode: convergence,
      normal_rate_pct: convergenceTotal ? Number((normalTransitions / convergenceTotal * 100).toFixed(4)) : null,
      clock: { start_time: startTime, start_time_source: (epoch(market.start_time) ?? 0) > 0 ? "start_time" : "create_time", end_time: endTime, scale, raw_tte_s: rawTte, effective_tte_s: rawTte === null ? null : rawTte / scale },
      error_rate_per_min: null,
      availability: { convergence: decisions.length > 0, clock: endTime !== null, error_rate: false },
    },
    intraday: {
      tte_observations: Object.values(observations),
      planned_rate_per_min: decisions.length ? planned / observedMinutes : null,
      blocked_rate_per_min: decisions.length ? blocked / observedMinutes : null,
      settlement_risk_factor: settlementRisk,
      availability: { tte_observations: decisions.length > 0 && endTime !== null, decision_rates: decisions.length > 0, settlement_risk: settlementRisk !== null },
    },
    endgame: {
      transitions_by_mode: transitions,
      reduce_only_orders: audits.length,
      reduce_only_quantity: reduceOnlyQuantity,
      expired_waiting_result_rate_per_min: expiredMinutes ? expiredRows.length / expiredMinutes : null,
      audits,
      availability: { transitions: decisions.length > 0, reduce_only: audits.length > 0, expired_waiting_result_rate: expiredRows.length > 0, audits: audits.length > 0 },
    },
  };
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const conditionId = incoming.searchParams.get("condition_id")?.trim() ?? "";
  if (!/^0x[a-f0-9]{64}$/i.test(conditionId)) {
    return NextResponse.json(
      { error: "condition_id must be a 32-byte hex value" },
      { status: 400 },
    );
  }

  const source = reviewEndpoint();
  if (!source) {
    return NextResponse.json(
      { error: "Strategy dashboard Review API is not configured" },
      { status: 503 },
    );
  }
  source.searchParams.set("condition_id", conditionId);

  const headers = new Headers({ accept: "application/json" });
  const clientId = process.env.CF_ACCESS_CLIENT_ID ?? process.env.CLOUDFLARE_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET ?? process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
  if (clientId && clientSecret) {
    headers.set("CF-Access-Client-Id", clientId);
    headers.set("CF-Access-Client-Secret", clientSecret);
  }

  try {
    const response = await fetch(source, {
      headers,
      cache: "no-store",
      redirect: "manual",
    });
    if (response.status === 404) {
      const compatibilityPayload = await buildCompatibilityReview(source, conditionId, headers);
      if (!compatibilityPayload) {
        return NextResponse.json({ error: "Review market not found" }, { status: 404 });
      }
      return NextResponse.json(compatibilityPayload, {
        headers: { "cache-control": "no-store" },
      });
    }
    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { error: "Review upstream did not return JSON", status: response.status },
        { status: 502 },
      );
    }
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Review upstream failed" },
      { status: 502 },
    );
  }
}
