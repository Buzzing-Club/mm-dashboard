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

- 工作目录：`/opt/mm-dashboard`
- 环境变量文件：`/opt/mm-dashboard/dashboard.env`
- 容器：`mm-dashboard-preview`
- 容器监听：`127.0.0.1:3001`
- 本地访问：SSH 转发到 `http://localhost:3010/`

`dashboard.env` 至少包含以下变量，文件不得提交：

```text
STRATEGY_DASHBOARD_API
OPENAPI_BASE_URL
OPENAPI_API_KEY
OPENAPI_API_SECRET
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
- `/api/dashboard/review?condition_id=<condition_id>`
- 实时看板的类别和状态筛选
- Review 的市场搜索、类别筛选及单市场切换

当前主机最初由文件同步部署。交接后应让 `/opt/mm-dashboard` 成为 `preview` 的 Git checkout；迁移时保留 `dashboard.env`，不要覆盖或提交该文件。

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
- `app/api/dashboard/market-realtime`
- `app/api/dashboard/market-realtime-batch`
- `app/api/dashboard/market-history`
- `app/api/dashboard/review`

前端页面只消费这些 Dashboard BFF 路由，不应直接持有后端 API Key。新增字段时先在 `preview` 验证数据口径、空值和超时行为，再决定是否为 `vercel-mock` 增加对应 Mock 样本。

## 已知状态

- Vercel Mock 与 Preview 当前从同一版 UI 起步。
- Preview 已配置策略端和后端凭据，但 Review 上游偶尔返回 `400/502`，页面会回退演示复盘。
- Preview 目前没有仓库级自动部署。后端接手后应优先补充只针对 `preview` 分支的 CI/CD，并把 SSH 主机、用户和私钥放入 GitHub Actions Secrets。
