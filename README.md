# Market Making Realtime Dashboard

预测市场做市实时看板与策略复盘界面。项目同时维护公开 Mock 演示和 Preview 真实数据联调两个环境。

## 环境分支

- `vercel-mock`：Vercel 公开演示，只使用源码内置 Mock。
- `preview`：策略 Preview 主机上的真实接口联调环境，也是 GitHub 默认开发分支。
- `main`：保留为未来正式环境的发布基线，当前不绑定部署。

后端接手、合并和部署规则见 [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md)。

Review 后端撮合、账本及结算接入说明、实测与剩余范围见 [`docs/REVIEW_BACKEND_INTEGRATION.md`](docs/REVIEW_BACKEND_INTEGRATION.md)。

## 当前范围

- 只处理飞书文档中的「市场看板（实时展示）」部分。
- 按文档拆成三个子看板：
  - 宏观业务指标：交易规模、用户规模、当前市场 PnL、刷量与成交总量占比。
  - 用户体验指标：闪单状态、流动性、成交平均滑点、订单簿历史点差、订单簿斜率。
  - 市场风控指标：风控状态、摆单策略提示、库存、预算、数据延迟与策略事件。
- 只展示和诊断，不在看板内下发做市参数。
- 总体筛选区包含跨市场风控状态分布，以及成交额、滑点、空盘和 L1 距离异常排名。
- 实时看板可在“当前市场 / 历史市场”之间切换；历史市场读取策略端持久化的最后有效运行快照。

## 数据口径

Review 生命周期 13 项指标和 PnL 归因已按第七节及通用解释核对，详细定义、例子和真实数据缺口见 [Review 指标核对](docs/REVIEW_METRIC_AUDIT.md)。

Mock 数据参考了这些本地材料：

- `/Users/Admin/Documents/New project/pmmm/prd_market_dashboard_review.xml`
- `/Users/Admin/Documents/New project/pmmm/risk_status_block.xml`
- `/Users/Admin/Documents/New project/pmmm/research/market-spread-benchmark/README.md`
- `/Users/Admin/Documents/New project/pmmm/research/market-spread-benchmark/benchmark_research_v1.md`
- `/Users/Admin/Documents/New project/buzzing-mm-system/docs/FLASH_BOT.md`（`preview`）
- `/Users/Admin/Documents/New project/buzzing-mm-system/src/buzzing_mm/runtime/strategy_template.py`（`preview`）
- `/Users/Admin/Documents/New project/buzzing-mm-system/src/buzzing_mm/strategy/passive.py`（`preview`）
- `/Users/Admin/Documents/New project/pmmm/AGENTS.md`

Mock 的策略校准口径：

- 普通做市模板以 `ask_total_qty=30`、`bid_total_cash=16`、`q_max=80`、`reduce_only_ratio=0.75` 为基准。
- Flash 以生产实测约 `9.2 pair/min/market` 为总吞吐基准；Tier1 与 Mid 近似交替，当前活跃 pair 不超过 5。Tier1 通常距 L1 一档，Mid 位于第 2-5 档。
- 空盘按策略的 4 秒确认、30 秒告警门槛生成。正常市场只允许偶发短事件；盘口缺失市场表现为一次持续事件。
- 滑点由当前 spread、mid、盘口流动性和策略状态联合推导，并按成交金额递增；它不是与盘口无关的随机数。
- 外部市场研究只用于约束合理范围：低成交预测市场买入 overround 中位数约 3.4%，低流动性长尾显著更宽。

后续真实 API 可先按当前 `Market` 类型替换数据源：

- 后端聚合：`gross_volume`、`net_volume`、`trader_count`、`current_pnl`、`wash_volume_ratio`
- 撮合/订单簿：`best_bid`、`best_ask`、`bid_levels`、`ask_levels`、`avg_trade_slippage`
- 策略端：`risk_status`、`quote_mode`、`risk_reason`、`inventory`、`q_max`、`worst_case_pnl`

### 新增体验质量契约

策略端 `/api/dashboard/realtime` 可在单市场 item 中增量返回 `experience_quality`，旧响应不受影响：

- `observed_duration_s`：统计窗口秒数。
- `single_sided_empty`：单边空盘的 `count`、`duration_s`、`duration_ratio`。
- `double_sided_empty`：双边空盘的 `count`、`duration_s`、`duration_ratio`。
- `l1_distance_threshold_pct`：L1 距离异常阈值，当前看板口径为 `0.01`。
- `l1_distance_exceeded`：L1 超距的 `count`、`duration_s`、`duration_ratio`。
- `incidents[]`：异常发生时间、类型、持续时间和可选的实际距离，用于时间轴和图表标记。
- `history[]`：`slippage_pct` 与 `impact_pct` 时序，用于用户体验趋势图。

后端单市场接口可在 `slippage.distribution_by_notional[]` 返回金额区间、成交笔数和平均滑点。策略聚合接口也兼容将该数据放在 `backend_required.slippage_distribution_by_notional[]`。

后端历史与批量接口已经接入：

- `GET /dashboard/markets/{condition_id}/history`：提供 Gross/Net Volume 累计序列、区间成交量、历史 PnL、成交滑点和成交后 5 秒价格冲击。看板按 `15m/1h/4h` 分别请求 `1m/5m/15m` 粒度。
- `POST /dashboard/markets/realtime/batch`：一次补齐最多 100 个市场的当前业务、PnL 和滑点摘要，单个市场失败不会影响其余市场。
- 空字符串代表没有样本，看板保留为断点，不按 0 展示。历史 PnL `truncated=true` 或 `pnl_included=false` 时显示为不可用。
- `mark_price_source` 与 `impact_horizon_seconds` 会展示在图表下方，避免把历史成交价估值误解为实时盘口估值。

缺少上述字段时，真实 API 模式会明确显示“待接入”或“等待数据”；mock 模式提供完整示例，便于评审交互。

### 市场生命周期契约

策略端 `/api/dashboard/realtime` 的 `lifecycle` 同时提供交易期和结算期信息：

- `start_time`、`end_time`：市场开盘时间与计划结束时间。
- `settlement_phase`：`none`、`announcing`、`ruling1`、`dispute1`、`ruling2`、`dispute2` 或 `claimable`。
- `current_outcome`、`dispute_count`、`phase_end_timestamp`：当前暂定结果、累计质疑次数和当前阶段截止时间。
- `settled_outcome`、`settled_at`、`closed`：最终结果、链上结算完成时间和终态标记。

风控看板将生命周期与策略状态事件绘制在同一条绝对时间轴上：青色为开盘，黄色为计划结束/裁定阶段，红色为质疑阶段，绿色为链上结算完成。已实际运行后停止，或已经到达结束/结算阶段的市场，由策略端 `/api/dashboard/history` 返回最后有效快照并进入“历史市场”；停止后的空运行态不会覆盖最后的盘口、风控与指标数据。

Mock 中包含三类可直接检查的样例：普通交易中市场、`BLACKWATER-GINEBRA-JUL24` 第一次质疑、`MAGNOLIA-MERALCO-JUL24` 链上结算完成。

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000/
```

## 验证

```bash
npm run build
```

## Vercel Mock 发布

当前 mock 数据已经随源码提交，主要在 `app/page.tsx` 的 `manualMarkets`、`prodMarketSeeds` 和 mock enrichment helper 中，不依赖后端环境变量。

Vercel Production Branch 使用 `vercel-mock`。从 Vercel 导入 GitHub 仓库时使用：

- Repository: `Buzzing-Club/mm-dashboard`
- Framework Preset: `Next.js`
- Build Command: `npx next build`
- Install Command: `npm install`
- Node.js: `22.x`

不配置环境变量时页面自动回退到 mock。接真实数据时配置：

- `STRATEGY_DASHBOARD_API`
- `CF_ACCESS_CLIENT_ID`、`CF_ACCESS_CLIENT_SECRET`（策略接口受 Cloudflare Access 保护时）
- `OPENAPI_BASE_URL`、`OPENAPI_API_KEY`、`OPENAPI_API_SECRET`（后端单市场指标）
