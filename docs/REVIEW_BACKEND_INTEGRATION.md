# Review 后端事实接入（2026-09-11）

依据：[后端实现进展](https://trufflelabs.jp.larksuite.com/wiki/BDc8weKGai5fi7kKHFQjp9KYpFg)及 buzzing_backend 的 `docs/orderbook_openapi.md`（Preview 分支）。只使用 Preview 配置，不访问 Prod 数据。

## 已实现

新增只读 BFF：`GET /api/dashboard/review-backend?condition_id=<condition_id>`。浏览器只获取汇总和有界批次，不持有签名密钥。

| 展示 | 后端事实 | 计算与限制 |
| --- | --- | --- |
| 盘中用户吃单平均档位和分布 | `/dashboard/markets/{id}/fills` | user_ref + order_ref 每单一次；完整 order_fill_count、level_index 分组；直接用 consumed_levels，不能将 level_index 当档位。首笔撮合决定阶段。过滤 wash/internal/self，分页分类版本必须一致。 |
| 单市场点差 PnL | fills 的 self 成交腿、quantity、quote.mid | 买入 `(mid-price)*qty`；卖出 `(price-mid)*qty`。互补 outcome 的 maker 使用 `1-mid` 和其自身成交价。仅汇总有快照的账户腿，并展示覆盖率，不冒充全量。 |
| 单市场已实现收益、手续费、领取额 | `/account/activities` | sell + win/lose 的 realized_pnl；claim 是领取现金且 realized_pnl=0，不重复计收益；手续费独立显示，不再从含费收益中扣一次。 |
| 已处置敞口批次 | activities 的 buy/sell/win/lose/split/merge | 同持仓与资金归属内按 FIFO 配对；收益归入建仓阶段。只算已处置批次，不估造未处置库存。后台收益是含费加权平均成本，因此此项是 FIFO 毛收益归因，不要求逐阶段等于账本收益。 |
| 阶段已实现收益 | activities.timestamp_ns | 按实际处置发生阶段汇总；盘后结算仍进入生命周期合计，但不挤入尾盘。不是含浮盈的阶段总 PnL。 |
| 结算事实与时间轴 | `/markets?condition_id=...` 的 data.settlement | chain_id、report_status、report_tx_hash、timeline；争议/可领取不同颜色。未上报或空时间轴不是错误，也不代表链上已结算。 |

金额/数量统一 `usdb_raw6 / 1e6`；价格不缩放。纳秒排序使用 BigInt，游标通过 URLSearchParams 编码。只有成功账本事件计收益，失败事件不计。Preview 网络实测以上接口 HTTP 200/code 0。

阶段仍以市场起止时间的 20% / 60% / 20% 划分。开始时间缺失使用创建时间；不是首末成交或刷新时间。

## 具体例子

- 用户一个订单产生三笔撮合，consumed_levels 都是 2、order_fill_count 都是 3：统计 1 单、2 档，而不是 3 单或 3 档。
- 买入 YES 10 shares，price=0.48，批次前 mid=0.50：点差 +0.20 USDB。如果 maker 对应 NO，须换成 NO 的 mid=0.50；一般场景为 1-YES mid。
- 买入 10 shares 成本 4 USDB，最终 win 的 realized_pnl=6，claim 领取 10：已实现利润为 6，不是 16；领取额为 10。
- split 30 套，YES/NO 各记 value=15：拆分支出合计 30；merge 两腿合计收入 30；不能把两腿各当成 30 或当成利润。
- 旧成交 has_quote=false：点差为缺失，不是 0。后端明确 2026-09-11 上线前的盘口不回填；pre_batch 只是批次落库前盘口，不是逐撮合瞬时盘口。

## 资源约束

- 仅按当前选择市场读取；fills/activities 顺序读取，各最多 8 页、每页 500 条；超限显示部分历史。
- 固定本次查询 `to`，每页最多 2 MB，每请求 12 秒、整个读取 45 秒截止。
- 最多 2 个市场读取并发，同市场合并在途请求；60 秒缓存、最多 24 份汇总，缓存不保留原始历史。
- 不新增后台抓取、每 tick 审计、30 秒快照或全市场历史 fan-out，不修改 MM 执行服务。

## Preview 实测

- Red（condition `0xb54de40ca7ba176790377a485e5f4cfb219d7759d8035207de4c83f8c6b7ea15`）：读取 4000 笔撮合触发上限，明确标部分样本；盘中 5 个完整自然用户订单，平均 1 档。8 条账户账本；旧撮合无盘口，点差为空。
- test--market3（condition `0x5f55d604468db2fbb9ff3dfd983171e3f04be5e90ef7414a32450de3757c469e`）：168 条账本，split/merge 各 1260 USDB，已实现利润 0，FIFO 两腿配对成功；尚未到来的尾盘为空。
- 单元测试覆盖互补成交腿、纳秒排序、重复记录、洗量过滤、跨阶段订单、缺失盘口、claim 不重复收益、split/merge、资金隔离、历史截断、分页异常和响应体上限。
- 36 项测试、TypeScript、ESLint 通过；真实 Preview 页面经 Playwright 在 1440px 与 390px 检查，批次列表内部滚动，页面无横向溢出或运行错误。

## 尚未完成及归属

这些不再统一写成“后端缺接口”：

1. 已实现首版全市场阶段汇总和历史阶段末库存近似估值，计算方法及覆盖限制见 [阶段聚合与策略观测](REVIEW_PHASE_AGGREGATION.md)。未完整读取的账本仍无法给完整结论；上限不会静默提高。
2. MM 与 TradeVolume 执行角色：backend self/internal/user 是账户分类，不等于策略角色。当前账本面板明确显示 Key 账户范围；指标若需纯 MM，仍须关联策略订单角色，不能用 internal 代替。
3. 已接策略 review-observations 的毒性、回摆、观察区间盘口健全率、供给转化及两类报价确认延迟。它们是增量捕获，不是完整历史；延迟不是外部数据源发布时间至确认的精确网络端到端值。新 backend fills 不替代这些策略事实。
4. 访问/互动/试价/取消漏斗仍需行为埋点。
5. 旧盘口、策略保留期外历史与未完成观察窗属于真实覆盖缺口，不补 mock/0。后端新增字段已接并不意味着每个 Preview 市场都有正样本。

Vercel 继续独立 Mock；不得同步 Preview 环境变量到公共演示站点。
