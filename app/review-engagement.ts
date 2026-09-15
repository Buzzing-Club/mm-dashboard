// Mixpanel 行为漏斗：把交易产品埋点按市场聚合成 Review 的「访问 → 提交」漏斗。
// 所有环境共用一个 Mixpanel project，所以环境归属必须逐条判定；判不出的事件单独计数，不并入任何环境。

export type EngagementEnvironment = 'prod' | 'preview';

export const ENGAGEMENT_STAGES = [
  { stage: '进入市场', event: 'market_detail_enter' },
  { stage: '交易互动', event: 'market_trade_panel_enter' },
  { stage: '尝试报价', event: 'bet_option_click' },
  { stage: '提交订单', event: 'market_order_submit' },
] as const;

export type EngagementStage = { stage: string; event: string; events: number; users: number; conversion: number };

export type ReviewEngagement = {
  source: 'mixpanel';
  conditionId: string;
  marketId: string;
  environment: EngagementEnvironment;
  from: string;
  through: string;
  complete: boolean;
  stages: EngagementStage[];
  unattributed: number;
  otherEnvironment: number;
  notes: string[];
};

type Row = { event?: unknown; properties?: Record<string, unknown> };

function lower(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// Web 埋点带 environment（线上值是 prod，不是 production）；App 埋点没有 environment，靠 env_mode / api_env 归属。
export function eventEnvironment(properties: Record<string, unknown>): EngagementEnvironment | null {
  for (const value of [lower(properties.environment), lower(properties.env_mode)]) {
    if (value === 'prod' || value === 'production') return 'prod';
    if (value === 'preview') return 'preview';
  }
  const api = lower(properties.api_env);
  if (api.includes('//preview-api.')) return 'preview';
  if (api.includes('//prod-api.')) return 'prod';
  return null;
}

export function buildEngagement(input: {
  rows: Row[];
  conditionId: string;
  marketId: string;
  environment: EngagementEnvironment;
  fromMs: number;
  throughMs: number;
  complete: boolean;
  notes?: string[];
}): ReviewEngagement {
  const events = new Map<string, number>();
  const users = new Map<string, Set<string>>();
  let unattributed = 0, otherEnvironment = 0;
  for (const row of input.rows) {
    const properties = row.properties;
    if (!properties || typeof row.event !== 'string') continue;
    if (String(properties.market_id ?? '') !== input.marketId) continue;
    const seconds = Number(properties.time);
    if (!Number.isFinite(seconds) || seconds * 1000 < input.fromMs || seconds * 1000 > input.throughMs) continue;
    if (!ENGAGEMENT_STAGES.some((stage) => stage.event === row.event)) continue;
    const environment = eventEnvironment(properties);
    if (environment === null) { unattributed++; continue; }
    if (environment !== input.environment) { otherEnvironment++; continue; }
    events.set(row.event, (events.get(row.event) ?? 0) + 1);
    const person = String(properties.distinct_id ?? properties.anonymous_id ?? '');
    if (person) {
      const set = users.get(row.event) ?? new Set<string>();
      set.add(person);
      users.set(row.event, set);
    }
  }
  const top = users.get(ENGAGEMENT_STAGES[0].event)?.size ?? 0;
  const notes = [...(input.notes ?? [])];
  if (unattributed) notes.push(`${unattributed} 条事件无法判定环境，未计入漏斗。`);
  return {
    source: 'mixpanel',
    conditionId: input.conditionId,
    marketId: input.marketId,
    environment: input.environment,
    from: new Date(input.fromMs).toISOString(),
    through: new Date(input.throughMs).toISOString(),
    complete: input.complete,
    stages: ENGAGEMENT_STAGES.map(({ stage, event }) => {
      const count = users.get(event)?.size ?? 0;
      return { stage, event, events: events.get(event) ?? 0, users: count, conversion: top > 0 ? count / top * 100 : 0 };
    }),
    unattributed,
    otherEnvironment,
    notes,
  };
}

// Raw Export 的 from_date/to_date 按 UTC 切天（不是 project 时区 Asia/Shanghai），且 to_date 不能晚于 UTC 今天，否则 400。
// 2026-09-16 实测：UTC 18:48 的事件只出现在前一个 UTC 日期里。
export function exportDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}
