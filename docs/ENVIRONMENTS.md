# Dashboard 环境与分支交接

## 分支职责

| 分支 | 用途 | 数据源 | 部署目标 |
| --- | --- | --- | --- |
| `vercel-mock` | 对外演示、产品和视觉评审 | 源码内置 mock；不得配置 Preview 密钥 | Vercel 正式域名 `https://mm-dashboard-umber.vercel.app/` |
| `preview` | 后端与策略端 API 联调、真实数据验证 | Preview `dashboard.env` | Preview 主机 `/opt/mm-dashboard`，容器 `mm-dashboard-preview` |
| `main` | 未来正式环境的发布基线 | 尚未启用 | 当前不绑定部署 |

GitHub 默认分支设为 `preview`。后端新增接口适配、字段口径调整和真实数据问题修复，均从 `preview` 建 feature 分支并向 `preview` 提 PR。

## 合并规则

1. API 接入和 Preview 专属配置只合入 `preview`。
2. 纯 UI、类型定义和无环境依赖的通用改动先在 `preview` 验证，再单独向 `vercel-mock` 提 PR。
3. Mock 样本、演示文案和仅用于公开评审的内容只合入 `vercel-mock`。
4. 不直接在 `preview`、`vercel-mock` 或 `main` 上开发；使用 feature 分支和 PR。
5. 不在两个环境分支之间整分支 merge。只挑选经过确认的独立提交，避免把真实接口地址或 Preview 行为带进 Vercel Mock。

建议命名：

- `feature/<topic>`：后端或策略数据接入，目标分支为 `preview`。
- `fix/<topic>`：Preview 联调修复，目标分支为 `preview`。
- `demo/<topic>`：Mock 展示改动，目标分支为 `vercel-mock`。

Codex 自动创建分支时继续使用 `codex/` 前缀。

## Preview 部署

Preview 服务部署在策略 Preview 主机：

- SSH：`ubuntu@15.134.122.105`（2026-09-11 迁移；旧地址不再使用）
- 工作目录：`/opt/mm-dashboard`
- 环境变量文件：`/opt/mm-dashboard/dashboard.env`
- 容器：`mm-dashboard-preview`
- 容器监听：`127.0.0.1:3001`
- 本地访问：SSH 转发到 `http://localhost:3010/`

2026-09-11 后端 Review 接入版使用独立发布目录 `/opt/mm-dashboard-review-backend-20260911`，挂载到容器 `/app`，复用 `/opt/mm-dashboard/node_modules`。环境变量仍从原目录的 `dashboard.env` 读取。切换后旧容器保留为 `mm-dashboard-preview-before-backend-20260911`（停止状态），旧 checkout 不覆盖。后续部署应先检查容器 Mounts，不要误以为修改原目录就会更新运行版本。

该发布给 Dashboard 容器设置 768 MiB 内存上限和 Node 512 MiB 堆上限。该限制不作用于 MM 服务。回退时停止新容器，启动上述旧容器即可恢复同一 localhost:3001 端口；避免同时启动占用同一端口。

后续阶段聚合版本发布目录为 `/opt/mm-dashboard-review-phases-20260911`，沿用上述凭据、依赖及内存限制。候选在 localhost:3002 验证后切到3001，保留前一版容器为 `mm-dashboard-preview-before-phases-20260911`。部署时核对容器 revision 标签和 Mounts。新版阶段 PnL 在进入 Review 时自动顺序读取已结束市场的离线汇总，不设置定时全市场任务。实际发布状态以 PR 验证评论为准。

`dashboard.env` 至少包含以下变量，文件不得提交：

```text
STRATEGY_DASHBOARD_API
STRATEGY_DASHBOARD_HISTORY_API  # 可选；默认由 realtime 地址推导
OPENAPI_BASE_URL
OPENAPI_API_KEY
OPENAPI_API_SECRET
REVIEW_SUMMARY_DIR  # Preview 必填，例如 /data/review-summaries；必须挂载主机持久目录
```

部署前执行：

```bash
git fetch origin preview
git switch preview
git pull --ff-only origin preview
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
```

完成构建后重启 `mm-dashboard-preview`，并分别验证：

- `/api/dashboard/realtime`
- `/api/dashboard/history`
- `/api/dashboard/review?condition_id=<condition_id>`
- `/api/dashboard/review-facts?condition_id=<condition_id>`（第 7 条采样聚合）
- `/api/dashboard/review-backend?condition_id=<condition_id>`（后端撮合、账本与结算归因）
- `/api/dashboard/review-portfolio?condition_id=<condition_id>`（已结束市场的持久化阶段汇总）
- 实时看板的类别和状态筛选
- Review 的市场搜索、类别筛选及单市场切换

当前主机最初由文件同步部署。交接后应让 `/opt/mm-dashboard` 成为 `preview` 的 Git checkout；迁移时保留 `dashboard.env`，不要覆盖或提交该文件。

### 离线 PnL 汇总保存

- 挂载 `/opt/mm-dashboard/review-summaries:/data/review-summaries` 并设置 `REVIEW_SUMMARY_DIR=/data/review-summaries`。容器替换时复用此目录，不放入发布目录或临时容器层。
- 每市场、每 OpenAPI 凭据身份仅保存一个小型 JSON，最多 64 KB；不保存成交原始列表、订单簿或私钥。文件名使用身份与 condition 的哈希，文件权限 0600。写入临时文件后原子替换。
- 首次读取从现有后端历史接口顺序聚合并保存；24 小时内直接读盘。页面刷新或再次进入不要求用户重新点击计算。
- 24 小时后在下一次访问时更新；手动更新有 60 秒复用窗口。盘后结算仍会变化，因此不是把到期未结算 PnL 永久冻结，也不是按当前盘口实时估值。
- 上游失败/分页不完整保留旧记录并显示警告；冷启动失败不落盘假零。磁盘写失败明确提示未保存。没有配置目录时接口报错，不静默使用进程内存冒充持久化。
- 前端顺序读取，服务端同键合并请求、全局最多两个聚合请求；原后端每市场 8 页、45 秒等限制保留。没有常驻全市场扫描任务。
- 汇总各行可以有不同历史截止时间，UI 展示范围及每行截止时间；不能宣称“统一实时截止”。只有已结束市场进入此面板，暂停或做市任务停止本身不算市场结束。
- 本目录每市场一个文件，市场数量持续增长时由运维按业务留存要求归档；本版本不自动删除历史汇总。

## Vercel Mock 部署

Vercel 项目的 Production Branch 应设置为 `vercel-mock`。该环境不配置策略或后端变量，因此 API 不可用时必须显示内置 Mock，并清楚标识 `MOCK` 或 `REVIEW MOCK`。

发布流程：

1. 从 `vercel-mock` 建 `demo/<topic>` 分支。
2. PR 目标选择 `vercel-mock`。
3. 检查 Vercel Preview 后合并。
4. 验证正式域名的实时看板和 Review。

## 后端接手范围

后端主要维护 Dashboard 的服务端聚合层：

- `app/api/dashboard/realtime`
- `app/api/dashboard/history`
- `app/api/dashboard/market-realtime`
- `app/api/dashboard/market-realtime-batch`
- `app/api/dashboard/market-history`
- `app/api/dashboard/review`
- `app/api/dashboard/review-facts`

前端页面只消费这些 Dashboard BFF 路由，不应直接持有后端 API Key。新增字段时先在 `preview` 验证数据口径、空值和超时行为，再决定是否为 `vercel-mock` 增加对应 Mock 样本。

## 已知状态

- 2026-09-13 Review 修复：当前目录缺失时，仅按选中 condition 读取结束归档（limit=1）及持久化观测恢复市场身份/生命周期，不修改共享缓存、不混入其他账户。Review 选择器和阶段 PnL 汇总仅包含已结束市场：到达源数据中的结束时间、明确 closed 或进入结算阶段即可，不要求链上结算完成。暂停、停止做市、存在归档本身不视为结束；缺少有效结束时间且没有结束标志时不进入 Review。风险面积优先读取有界持久累计，决策折线仍明确标注有限采样。
- 数据空态区分“未观测到触发”“暂无用户样本”“观察窗不完整”“计划计数缺失”等；它们不表示上游缺陷已修复。旧阶段缺少计划计数、报价确认或完整公允价窗口无法事后补造。

- Vercel Mock 与 Preview 当前从同一版 UI 起步。
- Preview 已配置策略端和后端凭据。新版 Review 读取现有只读事实进行聚合；上游失败显示不可用，不回退演示数据。Vercel Mock 仍使用独立演示数据。
- Preview 目前没有仓库级自动部署。后端接手后应优先补充只针对 `preview` 分支的 CI/CD，并把 SSH 主机、用户和私钥放入 GitHub Actions Secrets。
