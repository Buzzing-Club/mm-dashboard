# Dashboard Prototype Change Log

## 2026-08-28

### Align overview filters with prod market labels

- Checked the MM Prod environment (`ubuntu@52.63.52.18`) in read-only mode.
- Confirmed current active prod market samples are mainly Philippines-focused markets across weather, economy/FX, politics, sports/esports, and media/TV.
- Confirmed the MM runtime database currently keeps event/market titles, slug, NegRisk flag, and pricing route, but not original raw market tags.
- Replaced the temporary overview filters `Live` and `Crypto` with market-label filters:
  - `Weather`
  - `Economy`
  - `Politics`
  - `Sports`
  - `Media`
- Kept `全部` and `异常` for the operator workflow: scan problematic markets first, then narrow by label or search.
- Updated mock market names/categories to match the prod market universe more closely.
- Added tag-aware search and a mobile layout guard for the expanded filter bar.

Verification:

- `npm run build` passed with the workspace Node runtime.
- Visual smoke check passed at `1690x940`; filter labels have no desktop overflow.

### Move market overview to the top of the workflow

- Reordered the page to match the intended operator flow:
  - First scan the market overview to find markets with market-making issues.
  - Search or select a specific market.
  - Then inspect that market's macro, user-experience, and risk metrics.
- Moved the market overview from the left sidebar into a full-width header section.
- Moved the three metric-category switcher below the selected-market header.
- Kept the existing visual style, cards, filters, and metric displays mostly unchanged.

Verification:

- `npm run build` passed.

### Split realtime dashboard into three metric subboards

- Kept the quant-trading terminal visual direction from the first prototype.
- Reworked the information architecture to match the product document:
  - `宏观业务指标`
  - `用户体验指标`
  - `市场风控指标`
- Added top-level category switching while preserving the selected market and market filters.
- Made KPI cards context-aware so each subboard surfaces only the metrics relevant to that category.
- Added dedicated subboard layouts:
  - Macro board: gross volume, net volume, trader count, PnL, wash ratio, business trend, market ranking.
  - Experience board: flash-order monitoring, liquidity, average slippage, spread history, bid/ask impact slope, order book snapshot.
  - Risk board: risk status, quote mode, inventory, worst-case PnL, source freshness, risk queue, strategy events.
- Fixed a hydration mismatch caused by rendering the live clock differently on server and client.

Verification:

- `npm run build` passed.
- Local preview: `http://localhost:3000/`
- Private preview: `https://market-making-realtime-dashboard.arthurqiuy.chatgpt.site`

Related commit:

- `5add558 Split dashboard into metric subboards`

## 2026-08-27

### Build first market-making dashboard prototype

- Created the initial dashboard project in `/Users/Admin/Documents/New project/dashboard`.
- Built a single-page mock realtime market-making console.
- Added mock markets covering representative strategy states:
  - `normal_quote`
  - `inventory_adjusted_quote`
  - `negrisk_group_protection`
  - `orderbook_missing`
  - `data_delay`
  - `paused`
- Added core UI surfaces:
  - Market list with filters and severity ordering.
  - Macro KPI strip.
  - Selected-market bid, mid, ask, and spread summary.
  - Risk state and strategy reason.
  - Inventory and worst-case PnL meters.
  - Data source freshness.
  - Order book depth.
  - Slippage distribution.
  - Volume, PnL, and spread trend.
  - Strategy event stream.
- Published an initial private Sites version.

Verification:

- `npm run build` passed.

Related commit:

- `ba3d4fe Build market making dashboard prototype`

## Repository State

- Local git repository: `/Users/Admin/Documents/New project/dashboard`
- Branch: `main`
- Remote source repository: `sites-origin`
- Sites project id is stored in `.openai/hosting.json`.
