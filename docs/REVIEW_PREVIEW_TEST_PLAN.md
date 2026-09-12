# Preview Review 场景验收（2026-09-13）

## 范围与保护

- 仅 Preview `ubuntu@15.134.122.105`、`test-admin.buzzing.app`，不操作策略 Prod 或 Vercel Mock。
- 新建 Event `MM Review QA 20260913 - Lifecycle`，三个独立二元市场，初始 YES 概率 0.50，计划结束北京时间 00:45。
- Dashboard 临时按显式 condition allowlist 展示本批市场；不删除其他数据、不停用其他任务。移除配置可恢复。
- 使用已授权 Preview 测试账户；保留真实内部流量标签，不把测试成交算自然用户。不向指标表插入模拟统计。
- 下单前检查维护、交易状态、余额、盘口。每笔最多 10 shares；主动测试累计成交名义金额最多 100 USDB，每市场最多 30 次主动下单。若超时先查订单，不盲重试。
- 只撤测试脚本自己的剩余订单，不对共享账户或其他市场全撤。策略风险门禁不绕过。
- 不重启共享 MM 验证持久化；查询 DB 和离线历史接口，必要时仅停止测试任务验证留存。

## 测试矩阵

| 场景 | 操作 | 验证指标与证据 |
| --- | --- | --- |
| Balanced PnL | 小额交替 BUY/SELL，包含部分平仓与剩余库存；YES/NO 独立核对 | 后端 fills、activities、盘口 pre_batch；成交量按撮合单计，点差 PnL 逐笔重算，已处置 FIFO 与未处置历史估值，阶段末累计和汇总不重复相加 |
| Repricing Recross | 做市真实成交后保持观察至少 90 秒；在支持的测试定价入口调整输入并回穿 | 30 秒毒性分类、60 秒回摆、1 分钟 Score；报价更新和盘口跟随延迟样本；无完整观察窗口不进分母，变更不能重建 actor 后冒充连续观察 |
| Tail Inventory | 形成小额方向库存；尾盘调整输入穿越 0.5；到期后停止主动交易 | 首次失衡、风险面积、尾盘反转、反转时及 30/120 秒敞口、YES/NO 流动性结构、waiting_result 残留率 |
| 全部市场 | 首次非零盘口、计划变更、间隔采样和持久化读取 | 初始流动性、健全时长、供给有效性；observed/gap/unknown 覆盖；读取时累计不重复 |
| 结束回顾 | 等待真实计划结束，观察结束归档，重复读取并比较 | 实时面板历史市场归档、快照时间与数值稳定；暂停任务不冒充市场结束；链上结算只能按实际状态呈现 |
| 图表 | 单市场、阶段切换、跨市场汇总，桌面与手机 | 单位、正负值、比例、标签、滚动、空样本状态；页面只显示本批市场且不显示 Mock |

## 验收分层

1. API 请求成功不是指标通过。需要匹配的原始事件、有效分母和正确阶段。
2. 数值为 0 可能是有效负样本；null 是未覆盖，不能改为 0。
3. 内部交易可验证策略与 PnL，但自然用户吃单档位/net volume 不因此完成正样本验收。
4. 前端行为埋点仍未接入，访问、试价、未提交漏斗不在本次真实成交验收内。
5. 归档不是完整生命周期历史；持久化空档、历史读取截断须单列缺陷。

## 进度

- [x] SSH、执行 worker、实际成功挂单回执正常。
- [x] 后台维护开关关闭；当前无维护范围；创建维护状态正常。
- [x] 提交三个独立市场的创建请求。
- [x] 取得 condition/job ID，确认链上资源与策略接管。
- [x] 执行小批量成交并核对后台和策略事实。
- [x] 执行盘中/尾盘交易和观察窗口检查；未覆盖的正样本及失败项见结果。
- [x] 配置测试市场展示范围并部署 Preview。
- [x] 检查 Review 图表、持久化、结束快照；冻结稳定性通过，完整性未通过。

具体 market ID、实际执行步骤、成交预算使用及未覆盖项见 [测试结果](./REVIEW_PREVIEW_TEST_RESULTS_20260913.md)。勾选代表检查已执行，不代表每个指标通过。

## 本批市场

Event ID `1331769`，创建时间 `2026-09-12T16:05:54Z`，计划结束 `2026-09-12T16:45:00Z`。后台目录 start_time 为 0，阶段按 create_time 回退：开盘至 16:13:43.2Z，盘中至 16:37:10.8Z。

| 场景 | market ID | condition ID | MM / TV job |
| --- | --- | --- | --- |
| Balanced PnL | 2811544 | `0xe85b355f56bb753fc8b17d8652857c0b4508b060b7168f9c8a4d52efc1fed704` | 1698 / 1701 |
| Repricing Recross | 2811545 | `0xbb74a9aefe8b8bb6fc73f3744d6b31cb1356ab98d9c7d9838b52a8b15e5b9df0` | 1697 / 1700 |
| Tail Inventory | 2811546 | `0x7e284e300c3de7838568087ccc1aa305d5d844911fec7f35f777a6e366675ae0` | 1696 / 1699 |

后台入口：<https://test-admin.buzzing.app/users/orderbook-market-stats?event_id=1331769>。

## 测试展示部署

- Dashboard PR #21 已合入 `preview`；构建 revision `a190c65`，50 项测试和 TypeScript 检查通过。
- 当前目录 `/opt/mm-dashboard-review-qa-20260913`，容器 `mm-dashboard-preview`，仍只监听 localhost:3001，SSH 转发 localhost:3010。
- 容器配置 `DASHBOARD_TEST_CONDITION_IDS` 为上述三个 condition 的逗号分隔字符串；实时列表和历史列表同时过滤，Review 选择器和 PnL 汇总使用相同范围。
- 此配置是展示过滤，不是访问控制；未删除任何其他市场、历史数据或任务。
- 恢复全量展示：保留当前其他容器参数，移除 `DASHBOARD_TEST_CONDITION_IDS` 后重建 Dashboard 容器。仅 restart 不会移除配置。也可停新容器、启动已保留的 `mm-dashboard-preview-before-qa-20260913` 回退到前版。
- 未变更策略部署或风控配置，未向 Vercel Mock 分支合并。
