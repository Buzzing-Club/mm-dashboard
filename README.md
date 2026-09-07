# Market Making Realtime Dashboard

预测市场做市实时看板原型。当前版本先用 mock 数据实现交互和信息架构，等后端与策略端 API 定稿后再替换数据源。

## 当前范围

- 只处理飞书文档中的「市场看板（实时展示）」部分。
- 按文档拆成三个子看板：
  - 宏观业务指标：交易规模、用户规模、当前市场 PnL、刷量与成交总量占比。
  - 用户体验指标：闪单状态、流动性、成交平均滑点、订单簿历史点差、订单簿斜率。
  - 市场风控指标：风控状态、摆单策略提示、库存、预算、数据延迟与策略事件。
- 只展示和诊断，不在看板内下发做市参数。
- 总体筛选区包含跨市场风控状态分布，以及成交额、滑点、空盘和 L1 距离异常排名。

## 数据口径

Mock 数据参考了这些本地材料：

- `/Users/Admin/Documents/New project/pmmm/prd_market_dashboard_review.xml`
- `/Users/Admin/Documents/New project/pmmm/risk_status_block.xml`
- `/Users/Admin/Documents/New project/pmmm/research/market-spread-benchmark/README.md`
- `/Users/Admin/Documents/New project/pmmm/AGENTS.md`

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

缺少上述字段时，真实 API 模式会明确显示“待接入”或“等待数据”；mock 模式提供完整示例，便于评审交互。

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

## Vercel 预览发布

当前 mock 数据已经随源码提交，主要在 `app/page.tsx` 的 `manualMarkets`、`prodMarketSeeds` 和 mock enrichment helper 中，不依赖后端环境变量。

从 Vercel 导入 GitHub 仓库时使用：

- Repository: `Buzzing-Club/mm-dashboard`
- Framework Preset: `Next.js`
- Build Command: `npx next build`
- Install Command: `npm install`
- Node.js: `22.x`

不配置环境变量时页面自动回退到 mock。接真实数据时配置：

- `STRATEGY_DASHBOARD_API`
- `CF_ACCESS_CLIENT_ID`、`CF_ACCESS_CLIENT_SECRET`（策略接口受 Cloudflare Access 保护时）
- `OPENAPI_BASE_URL`、`OPENAPI_API_KEY`、`OPENAPI_API_SECRET`（后端单市场指标）
