# Market Making Realtime Dashboard

预测市场做市实时看板原型。当前版本先用 mock 数据实现交互和信息架构，等后端与策略端 API 定稿后再替换数据源。

## 当前范围

- 只处理飞书文档中的「市场看板（实时展示）」部分。
- 按文档拆成三个子看板：
  - 宏观业务指标：交易规模、用户规模、当前市场 PnL、刷量与成交总量占比。
  - 用户体验指标：闪单状态、流动性、成交平均滑点、订单簿历史点差、订单簿斜率。
  - 市场风控指标：风控状态、摆单策略提示、库存、预算、数据延迟与策略事件。
- 初版只展示和诊断，不在看板内下发做市参数。

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
