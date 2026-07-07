# Deja Brew ERP: Café Management Ecosystem Audit and Roadmap

Date: 2026-05-10  
Scope note: POS checkout/billing UX is intentionally deprioritized per request. Billing data is still analyzed where it affects inventory, customer intelligence, auditability, and analytics. Chain, franchise, and multi-outlet execution are explicitly deferred to a later phase. The near-term product is for independent and single-outlet cafés first.

## 0. Bottom-Line Verdict

Deja Brew ERP is a strong single-café internal operations tracker, not yet a market-ready café SaaS or Petpooja-class operating system. The best existing foundation is the split between employee entry and owner analytics, recipe-based stock deduction, inventory movement grid, customer aggregation from bills, routines, petty-cash tracking, online-sales entry, banking handover, and CSV/PDF exports.

The product will not compete in the independent café market until it is rebuilt around five missing primitives:

1. Tenant, business-day, and device foundations, with a default single outlet internally.
2. Immutable event/audit ledger for money, stock, user actions, and edits.
3. Inventory as a financial and operational system, not just item quantity fields.
4. Real-time/offline sync for café outage and rush-hour realities.
5. Café intelligence: margin, wastage, recipe variance, demand, staff, vendor, customer retention, and alerts.

Current market readiness score: 41/100 for a single-outlet café operating system with POS ignored, or 34/100 for broader café SaaS. Multi-outlet and franchise readiness is intentionally not a near-term scoring target.

## 0.1 Near-Term Product Scope

Build now:

- Independent cafés.
- Single-outlet cafés.
- Owner-operated cafés.
- Small specialty cafés.
- Bakery cafés.
- QSR-style cafés.
- Cloud cafés that operate from one kitchen.
- Café inventory, daily close, owner intelligence, offline usage, customer retention, vendor purchasing, and wastage control.

Do not build now:

- Restaurant-chain workflows.
- Franchise hierarchy.
- HQ dashboards.
- Central kitchen dispatch.
- Inter-outlet transfer.
- Outlet leaderboard.
- Multi-location menu governance.
- Region-level roles.
- Enterprise SSO.
- API marketplace.

Technical caveat:

- Keep `tenant_id` because the product is SaaS.
- Keep a default `outlet_id` internally because future expansion should not require a database rewrite.
- Do not expose multi-outlet UX until the single-café product has strong retention and paying customers.

## 1. Project Audit

### 1.1 Codebase Structure

Backend:

- FastAPI app in `backend/server.py`.
- MongoDB via Motor in `backend/database.py`.
- Route-per-module structure in `backend/routes/*`.
- Pydantic request models live inside routers.
- No separate service/domain layer, repository layer, event model, job queue, migration system, or tenant middleware.

Frontend:

- React app under `frontend/src`.
- Active routes are `/entry/*` and `/dashboard/*` in `frontend/src/App.js`.
- Employee/owner route split exists.
- UI is handwritten Tailwind plus Shadcn/Radix primitives.
- Data fetching is direct page-level axios calls via `frontend/src/utils/api.js`.
- There is no global data cache, offline queue, optimistic sync layer, websocket client, typed API client, or feature flag system.

Dead/legacy code:

- `frontend/src/pages/Billing.jsx`, `Dashboard.jsx`, `FloatPage.jsx`, `Inventory.jsx`, `MenuPage.jsx`, `Reports.jsx`, `Settings.jsx`, and `WalkIns.jsx` appear unused by `App.js`.
- This increases maintenance risk because old modules can mislead future agents/developers.

### 1.2 Existing Modules

Implemented product surfaces:

- Entry: walk-ins, online sales, purchases, inventory, inventory movement, billing, bills, routines, menu/recipes, banking, misc payments, customers.
- Owner dashboard: overview, walk-ins, sales/top items, purchases, inventory, inventory movement, billing, banking, misc payments, customers, settings.
- Backend APIs: auth, users, walkins, menu, recipes, bills, inventory, inventory movements, float, online sales, routines, banking, misc payments, customers, dashboard analytics.

What is already excellent:

- Clear role split between employee operations and owner dashboards.
- Inventory movement grid is unusually café-relevant: daily OPEN/NEW/USED/CLOSE is close to real café stock sheet behavior.
- Recipe mapping exists and deducts ingredients from sold menu items.
- Routines can deduct ingredients for recurring non-sale usage such as machine tests.
- Dashboard has more than vanity metrics: AOV, revenue/person, discounts, tax, hourly breakdown, day-of-week breakdown, top items.
- Customer directory is automatically derived from bills and supports repeat/new segmentation.
- Petty-cash float and banking handover exist, which many prototypes ignore.
- PDF/CSV export exists for owner workflows.
- Deployment constraints are documented for Vercel, Render, and MongoDB Atlas.

What is average:

- CRUD patterns are understandable but route-heavy.
- Mongo indexes cover basic dates and IDs but not analytics-grade access patterns.
- UI is clean enough for owner/admin use, but too desktop/sidebar-heavy for floor staff tablets and phones.
- Dashboard insights are threshold summaries, not operational recommendations.
- Authentication works, but authorization is too coarse.

What is dangerous:

- No tenant/outlet IDs anywhere. The system is structurally single café.
- Inventory updates mutate `current_stock` directly without immutable stock ledger events.
- Recipe deduction and movement tracking are independent systems. The movement grid is not the source of truth for stock.
- Employees can create/update/delete inventory, recipes, routines, banking, online sales, misc payments, and walk-ins in many routes with no permission granularity.
- Deletes are physical deletes in several routes, losing fraud/audit trail.
- No approval flow, manager PIN, edit reason, void reason, or exception workflow.
- No transaction/session around bill insert plus inventory deduction.
- Inventory deduction swallows exceptions silently.
- Petty-cash purchase date UI is misleading because backend `POST /float/expenses` always writes to today.
- UTC dates are used for operational days in many write paths, while the café timezone is India. Late-night operations can land on the wrong business day.
- There is no offline mode. For Indian cafés, this alone blocks real deployment.

### 1.3 Backend Findings

Key code evidence:

- `backend/server.py` creates basic indexes but no compound tenant/outlet/reporting indexes.
- `backend/routes/inventory_router.py` models inventory as `name/category/section/current_stock/unit/min_quantity/cost_per_unit`.
- `backend/routes/inventory_movement_router.py` stores one movement document per item per day and derives USED as `OPEN + NEW - CLOSE`.
- `backend/routes/billing_router.py` inserts a bill, then deducts recipe ingredients afterward.
- `backend/routes/float_router.py` supports float by date for reads, but expense add/delete are hardcoded to today.
- `backend/routes/customers_router.py` aggregates customers from bills on demand.

Technical bottlenecks:

- Bill number generation uses daily `count_documents + 1`; concurrent creates can collide or skip.
- Analytics query live collections repeatedly; there is no daily materialized metrics table.
- `to_list(1000)`, `to_list(20000)`, and `to_list(None)` patterns assume small data.
- No pagination on bills, customers, inventory movements, users, online sales, banking, or reports.
- No API versioning, request IDs, idempotency keys, or structured error codes.
- No background worker for reports, alerts, exports, or AI jobs.
- No validation for allowed enum values in several places: payment mode, platform, roles, categories.
- No soft delete model.
- No audit metadata consistency: some docs have `created_by_name`, others only `created_by`, some deletes have neither.

### 1.4 Database Model Audit

Current collections:

- `users`
- `menu_items`
- `recipes`
- `inventory`
- `inventory_movements`
- `bills`
- `walkins`
- `online_sales`
- `float_days`
- `routines`
- `routine_executions`
- `banking`
- `misc_payments`

Missing enterprise collections:

- `tenants`
- `outlets`
- `business_days`
- `shifts`
- `staff_attendance`
- `roles`
- `permissions`
- `audit_events`
- `stock_items`
- `stock_lots`
- `stock_ledger`
- `stock_counts`
- `stock_variances`
- `waste_events`
- `purchase_orders`
- `goods_receipts`
- `supplier_invoices`
- `suppliers`
- `vendor_price_history`
- `internal_transfers`
- `central_kitchen_dispatches`
- `recipe_versions`
- `menu_item_cost_snapshots`
- `daily_item_sales`
- `daily_stock_snapshots`
- `customer_profiles`
- `customer_consents`
- `campaigns`
- `loyalty_accounts`
- `notifications`
- `device_sessions`
- `sync_outbox`
- `sync_inbox`
- `integration_accounts`
- `aggregator_orders`
- `aggregator_payouts`
- `reconciliation_runs`

The core DB redesign should make immutable ledgers primary and mutable summaries secondary.

### 1.5 Security and Permissions

Current roles:

- `owner`
- `employee`

Required roles:

- Owner
- Outlet manager
- Shift supervisor
- Cashier
- Barista
- Kitchen staff
- Inventory manager
- Accountant
- Auditor
- Support agent

Deferred later roles:

- Franchise admin
- HQ analyst

Required permission actions:

- `inventory.item.create`
- `inventory.stock.adjust`
- `inventory.stock.count.submit`
- `inventory.variance.approve`
- `recipe.edit`
- `menu.price.edit`
- `purchase.order.create`
- `purchase.receive`
- `vendor.edit`
- `cash.handover.create`
- `cash.handover.verify`
- `report.export`
- `user.create`
- `role.assign`
- `audit.view`

Current risk: an employee can perform too many operations with no second factor, reason capture, or manager approval. This is acceptable for a trusted single café but unacceptable for SaaS.

## 2. Café Industry Requirements vs Current System

Real cafés need:

- Rush-hour workflows with low cognitive load.
- Shift opening/closing and cash drawer reconciliation.
- Perishable inventory control for milk, cream, curd, fruits, batters, bakery, and syrups.
- Coffee bean tracking by roast date, bag/lot, grinder, and recipe.
- Recipe costing that understands yields, wastage, shrinkage, and unit conversion.
- Fast stock counts: morning open, afternoon mid-shift, close.
- Waste tracking by reason: spoilage, staff meal, wrong order, test, return, expired, spillage, over-prep.
- Vendor purchase cycle: PO, GRN, invoice, payment, returns, price changes.
- Swiggy/Zomato reconciliation: gross, net, commission, packaging, discounts, cancellation, payout mismatch.
- Staff accountability: who created, edited, deleted, discounted, adjusted, counted, transferred, received.
- Outlet/hub structure for central kitchen and franchise scaling.
- Customer repeat behavior, loyalty, birthday/occasion, favorite items, visit rhythm.
- WhatsApp/SMS/email receipts and campaigns with opt-in compliance.
- Offline continuity during internet failure.
- Thermal printer/KDS/customer display/tablet support.
- Real-time alerts for owner psychology: "cash short", "milk usage abnormal", "top item out soon", "today below forecast", "Zomato payout mismatch".

Current system lacks:

- True shift model.
- Business-day close.
- Cash expected vs actual reconciliation.
- Batch/expiry/lot tracking.
- Vendor and purchase-order lifecycle.
- Stock valuation.
- Wastage workflow.
- Internal transfer workflow.
- Unit conversion and yield management.
- Reorder logic based on consumption, lead time, and forecast.
- Real customer profiles and loyalty.
- Reconciliation of aggregator statements.
- Any offline-first implementation.
- Any multi-device real-time sync.
- Any franchise/multi-outlet architecture.

## 3. Competitor Comparison

Sources checked:

- Petpooja POS, inventory, online ordering, scan/order, app marketplace, reports pages.
- Restroworks platform, inventory, recipe, franchise pages.
- Posist enterprise, platform, analytics, BOH, cockpit app pages.
- Toast reporting, inventory, KDS, online ordering, products pages.
- Square Restaurants capabilities, quick-service, online ordering, KDS/dashboard pages.
- Shopify POS features and help center.
- Loyverse features and employee management pages.
- Oracle Simphony restaurant analytics page.

### 3.1 Petpooja

Petpooja strengths relevant to this project:

- Offline/cloud support, broad hardware support, QR scan and order, KDS, token management, captain app, CRM, loyalty wallet, SMS marketing, customer feedback.
- 150+ integrations and marketplace model.
- Inventory has raw material management, low-stock alerts, multi-stage recipes, central kitchen, purchase orders, supplier/outlet flows, stock availability linked to menu availability.
- Reports cover online orders, staff actions, inventory consumption, cancellations, payments, and dozens of downloadable reports.
- Online ordering supports Swiggy/Zomato/Dineout integration, menu availability toggles, aggregator reconciliation, packaging charges, platform payout details.

Current project advantages over Petpooja:

- Café-specific movement grid can become a powerful differentiator if tied to actual stock ledger and AI variance.
- The product can be built café-first instead of generic restaurant-first.
- Existing owner/employee split is simple and clean.
- Current UI has less enterprise clutter than legacy POS systems.

Where Petpooja is far ahead:

- Integrations.
- Offline continuity.
- Hardware ecosystem.
- Inventory depth.
- Staff rights/fraud controls.
- CRM and loyalty.
- Multi-outlet/central kitchen.
- Aggregator reconciliation.
- Operational add-ons.

How to dominate specifically in cafés:

- Do not try to beat Petpooja as a generic restaurant POS first.
- Win on café inventory intelligence: milk, beans, bakery expiry, recipe variance, wastage, reorder timing, vendor price shifts.
- Win on café owner dashboard: daily health score, margin leakage, dead menu items, repeat customer rhythm, peak staffing, stockout prediction.
- Win on simplicity: "close your café in 6 minutes" and "finish stock count in 10 minutes".
- Win on WhatsApp-first owner alerts in India.

### 3.2 Restroworks and Posist

Restroworks and Posist are enterprise-chain oriented: central menu, multi-outlet operations, forecasting, KDS, supply chain, central/base kitchen, anti-theft, enterprise reporting, open API, 150 to 500+ integrations, mobile cockpit.

Current project gap:

- No hierarchy: tenant/outlet/brand/region/franchise.
- No HQ-to-outlet menu control.
- No central kitchen.
- No stock transfer or supplier order process.
- No enterprise reporting table or role-specific dashboard.
- No open API/integration app model.

Potential advantage:

- Café-focused operating model can be narrower and faster to adopt than enterprise suites.

### 3.3 Toast, Square, Shopify POS, Loyverse, Oracle Micros

Modern global platforms emphasize:

- Real-time reporting and mobile owner dashboards.
- Kitchen performance metrics and KDS prep time.
- Offline payments/orders.
- Multi-location inventory and staff.
- Customer profiles and loyalty/marketing.
- Demand forecasting and purchase suggestions.
- Vendor/supplier/invoice tools.
- Custom roles and staff PINs.
- Hardware ecosystem and device management.
- BI exports, APIs, and enterprise integrations.

Current project gap:

- It has charts and exports, but not operational intelligence.
- It has customers, but not customer lifecycle or consent.
- It has inventory, but not inventory accounting.
- It has users, but not labor management.
- It has manual online sales, but not integrated orders/reconciliation.
- It has no mobile app, no offline store, and no device control.

## 4. AI Features That Actually Matter

### 4.1 Demand Forecasting

- Why it matters: cafés lose money through over-prep and stockouts, especially milk, bakery, cold brew, and dessert.
- Required data: item sales by 15-minute bucket, channel, day, weather, holidays, events, promotions, stockouts.
- Model: start with Prophet/LightGBM/XGBoost; later temporal fusion transformer for larger chains.
- Architecture: nightly feature job + daily forecast table + real-time adjustment from current sales.
- Complexity: medium.
- ROI: high.
- Priority: P1 once daily sales/item facts are materialized.

### 4.2 Milk Consumption Forecasting

- Why it matters: milk is high-frequency, perishable, leak-prone, and café-defining.
- Required data: milk opening/new/close, recipe milk grams/ml, sold beverages, routine test usage, waste events, vendor delivery times.
- Model: consumption-per-item regression plus anomaly bands.
- Architecture: stock ledger + recipe usage + movement count reconciliation.
- Complexity: low-medium.
- ROI: very high for cafés.
- Priority: P1.

### 4.3 Coffee Bean Yield and Variance Detection

- Why it matters: beans are expensive and theft/over-dosing is common.
- Required data: roast lot, grinder, recipe grams, item sales, calibration routines, waste, closing stock.
- Model: expected-vs-actual variance with Bayesian control limits.
- Architecture: stock ledger by batch + recipe version history.
- Complexity: medium.
- ROI: high.
- Priority: P1/P2.

### 4.4 Ingredient Anomaly and Theft Detection

- Why it matters: owners fear silent leakage more than low revenue.
- Required data: staff ID, shift, stock adjustments, bill edits, discounts, deletes, recipe expected usage, closing counts.
- Model: rules first, then isolation forest or robust z-score per outlet/item/shift.
- Architecture: immutable audit events + stock variance facts.
- Complexity: medium.
- ROI: high.
- Priority: P1 after audit ledger.

### 4.5 Employee Performance Intelligence

- Why it matters: cafés need to know who handles rush, who causes voids, who misses stock counts.
- Required data: shift attendance, action events, orders handled, errors, stock variances, cash short/over.
- Model: scorecards first; anomaly ranking later.
- Architecture: `staff_shift_metrics` materialized table.
- Complexity: medium.
- ROI: medium-high.
- Priority: P2.

### 4.6 Customer Churn and Repeat Prediction

- Why it matters: cafés win through repeat behavior.
- Required data: phone/customer ID, visit recency, frequency, spend, favorite items, campaign history.
- Model: RFM segmentation first; logistic churn model later.
- Architecture: customer profiles + consent + campaign events.
- Complexity: medium.
- ROI: high if WhatsApp campaigns are added.
- Priority: P2.

### 4.7 Peak-Hour and Staffing Recommendation

- Why it matters: under-staffed café rush kills experience; over-staffing kills margin.
- Required data: hourly sales, walk-ins, prep time, staff count, weather/events.
- Model: hourly demand forecast + staffing rule engine.
- Architecture: forecast table + shift scheduler.
- Complexity: medium.
- ROI: high for multi-shift cafés.
- Priority: P2.

### 4.8 Menu Profitability Optimization

- Why it matters: top revenue items can be low-margin traps.
- Required data: recipe cost, packaging cost, channel commission, discounts, wastage, item sales.
- Model: contribution margin engine + elasticity heuristics.
- Architecture: recipe versioning + cost snapshots + PMIX fact table.
- Complexity: medium.
- ROI: very high.
- Priority: P1/P2.

### 4.9 Predictive Reorder System

- Why it matters: owners want "what to buy today" not just "low stock".
- Required data: current stock, consumption velocity, vendor lead time, minimum display stock, forecast, expiry.
- Model: reorder point formula first; ML later.
- Architecture: `reorder_recommendations` generated daily and on stock changes.
- Complexity: medium.
- ROI: very high.
- Priority: P1.

### 4.10 Natural-Language Analytics

- Why it matters: owners ask "why was yesterday bad?" not "open dashboard filter".
- Required data: well-modeled metrics, semantic layer, safe SQL/aggregation tool.
- Model: LLM with constrained metric API, not direct DB free-for-all.
- Architecture: metrics catalog + query planner + explanation generator.
- Complexity: high.
- ROI: high for differentiation but only after metrics are trustworthy.
- Priority: P3.

## 5. Inventory and Movement Tracking

Current inventory:

- `inventory.current_stock` is mutable.
- `inventory_movements` is a manual stock sheet.
- Recipe deductions update inventory directly.
- Routines update inventory directly.
- Movement tracker does not reconcile against recipe/routine deductions.
- Purchases are float expenses, not stock receipts.

Enterprise café inventory needs:

- Item master: milk, beans, cups, lids, syrups, bakery, cleaning chemicals.
- Unit conversions: kg/g, L/ml, packet/piece, bag/gram, case/bottle.
- Batch/lots: receive date, expiry date, roast date, vendor, invoice price.
- Stock ledger: every movement is an event with source, reason, user, shift, outlet.
- Purchases: PO -> GRN -> invoice -> payment.
- Wastage: reason-coded and staff-attributed.
- Internal transfer: outlet to outlet, central kitchen to outlet, return damaged stock.
- Recipe versions: old bills keep old recipe cost.
- Costing: weighted average or FIFO with recipe cost snapshots.
- Variance: expected usage from sales/routines vs counted usage from OPEN/NEW/CLOSE.

Required redesign:

- Make `stock_ledger` immutable:
  - `tenant_id`, `outlet_id`, `business_day_id`, `item_id`, `lot_id`, `event_type`, `quantity_delta`, `unit`, `base_quantity_delta`, `source_type`, `source_id`, `reason`, `created_by`, `created_at`, `device_id`, `shift_id`.
- Keep `inventory_balances` as derived mutable cache:
  - `item_id`, `outlet_id`, `on_hand_base_qty`, `available_qty`, `reserved_qty`, `last_event_id`.
- Replace direct `$inc current_stock` with ledger append + balance projection.
- Turn the current movement grid into a stock-count workflow:
  - opening count, received from GRN, theoretical usage, actual closing count, variance, manager approval.

World-class café inventory features:

- Milk dashboard: opening/new/used/closing, expected milk usage, variance ml and percentage, spoilage by reason.
- Bean dashboard: roast lot, age since roast, grinder usage, expected grams per beverage, calibration wastage.
- Bakery expiry dashboard: sell-by, markdown suggestion, bundle suggestion, waste risk.
- Vendor price dashboard: milk price/litre trend, bean price/kg trend, packaging cost per order.
- Dead stock: items not used/sold in N days.
- Reorder: "Buy 18L milk before 11am tomorrow; vendor lead time 4h; forecasted usage 14.2L."

## 6. Analytics and Owner Dashboards

Current dashboards:

- Overview: revenue, bills, walk-ins, AOV, average party, revenue/person, simple insights.
- Sales: item quantity/revenue classification using median into STAR/WORKHORSE/DEAD.
- Purchases: petty-cash expenses, category breakdown.
- Inventory: total, low stock, out of stock.
- Customers: repeat/new, phone, lifetime spend.
- Banking: recent handover list.
- Billing: bills/tax/exports.

Missing dashboards:

- Daily operational close dashboard.
- Expected cash vs deposited vs float spent.
- Gross margin and contribution margin.
- Recipe cost trend and item profitability.
- Stock variance and theft risk.
- Wastage by reason/item/staff/shift.
- Expiry risk.
- Vendor price trend.
- Aggregator reconciliation.
- Customer cohort retention.
- Staff productivity.
- Kitchen/barista speed.
- Stockout lost-sales estimate.
- Forecast vs actual.
- Franchise/outlet leaderboard later, not in the independent-café roadmap.

Ideal café intelligence dashboard:

- Today health score: sales vs forecast, margin, cash variance, stock variance, waste, repeat customer rate.
- Rush map: hourly heatmap of sales/walk-ins/orders by channel.
- Margin board: top revenue, top profit, low-margin bestsellers, dead items.
- Inventory leakage board: expected vs actual milk/beans/packaging.
- Purchase board: spend vs forecast, vendor price movement, pending purchase orders.
- Staff board: shift actions, cash handover, stock adjustments, discount/edit/delete events.
- Customer board: new vs repeat, lapsed regulars, top customers, campaign candidates.
- AI recommendation feed: ranked actions with rupee impact.

## 7. UX/UI Audit

What works:

- Owner and employee workspaces are separated.
- Navigation is clear on desktop.
- Tables and forms are consistent.
- Movement grid is operationally familiar.
- Export buttons and filters are discoverable.

Core UX flaws:

- Fixed left sidebar consumes tablet width and is poor on mobile.
- Employee nav has too many peer-level items; no shift-based task flow.
- There is no "Today Command Center" for staff.
- Critical workflows are modal-heavy.
- Many employee actions are destructive without reason/approval.
- Inventory movement has fixed 120px columns, good for desktop, weak on small tablets.
- Dashboard cards are visually clean but too generic: they report, they do not guide.
- Error prevention is thin: no duplicate detection, no validation for suspicious values, no unsaved/offline state, no manager approval prompts.

Ideal café operator workflow:

1. Open shift: confirm opening cash, opening stock exceptions, staff on duty, device/printer status.
2. During shift: handle tasks from a Today Queue: low stock, pending counts, supplier receipt, cash handover, wastage log, customer campaign.
3. Mid-shift check: system flags milk/bean/packaging variance.
4. Close shift: count cash, count critical stock, confirm wastage, reconcile online platforms, submit close.

Ideal manager workflow:

- Approve stock adjustments.
- Review suspicious actions.
- Receive vendor stock.
- Handle staff shift edits.
- Review daily health score before leaving.

Ideal owner workflow:

- Open mobile dashboard.
- See "what changed", "what is leaking", "what to buy", "who needs attention", "which items to push".
- Drill into exact action trail, not just totals.

## 8. Scalability and Architecture

Current architecture limitation:

- Single FastAPI app with direct Mongo collection access.
- No tenant boundaries.
- No event bus.
- No realtime.
- No offline queue.
- No background workers.
- No materialized analytics layer.
- No durable device/session model.

Target architecture:

- API gateway/FastAPI monolith first, but with domain services:
  - Auth/Identity
  - Tenant/Outlet
  - Inventory
  - Purchase/Vendor
  - Sales/Orders
  - Customer/Loyalty
  - Analytics
  - Integrations
  - Notifications
  - Audit
- MongoDB can remain initially, but model ledgers carefully. For serious SaaS analytics, add Postgres or ClickHouse later.
- Add Redis for queues, locks, rate limits, websocket pub/sub.
- Add Celery/RQ/Arq workers for reports, exports, forecasts, alerts, reconciliation.
- Add websocket/SSE channels for inventory alerts, order status, dashboard refresh, device sync.
- Add offline-first local storage on client:
  - IndexedDB outbox.
  - Idempotency keys.
  - Sync conflict rules.
  - Business-day/device sequence numbers.
  - Server reconciliation endpoint.

DB index priorities:

- Every collection: `{tenant_id, outlet_id, business_day_id/date}`.
- Bills/orders: `{tenant_id, outlet_id, created_at}`, `{tenant_id, outlet_id, bill_number}`, `{tenant_id, outlet_id, customer_id}`.
- Stock ledger: `{tenant_id, outlet_id, item_id, created_at}`, `{source_type, source_id}`, `{business_day_id, item_id}`.
- Audit events: `{tenant_id, outlet_id, actor_id, created_at}`, `{entity_type, entity_id}`.
- Customers: `{tenant_id, phone}`, `{tenant_id, last_visit_at}`.
- Aggregator orders: `{tenant_id, outlet_id, platform, platform_order_id}` unique.

## 9. Modern Café Differentiators

High-value differentiators:

- Café-specific inventory AI: milk/beans/bakery/packaging variance.
- "Close Day in 6 Minutes" workflow.
- WhatsApp owner alerts with action links.
- Predictive purchase list by vendor.
- Smart item availability toggle when stock is below recipe requirement.
- Subscription coffee plans and prepaid wallet.
- Repeat customer nudges: "Kavin usually orders iced latte on Saturdays."
- Barista routine compliance: machine test, grinder calibration, cleaning checklist.
- Expiry-based promotions: "Push banana bread by 5pm."
- Vendor price intelligence: "Amul milk price up 8 percent vs last month."
- Café health score benchmarked by outlet.
- Instagram/social campaign hooks for new drinks and slow-day offers.
- Feedback/review analysis: detect complaints about wait time, taste, price, staff.

## 10. Revenue and SaaS Opportunities

Pricing packages:

- Starter café: single outlet, inventory, dashboards, exports.
- Growth café: AI reorder, WhatsApp alerts, loyalty, campaigns.
- Later multi-outlet: central kitchen, transfer, franchise dashboard, RBAC.
- Later enterprise: open API, custom reports, audit exports, SSO, role controls.

Revenue add-ons:

- WhatsApp/SMS campaign credits.
- Aggregator reconciliation.
- AI insights pack.
- Inventory advanced pack.
- Loyalty wallet/subscription pack.
- Franchise command center.
- Hardware setup/managed device package.
- Data migration from Petpooja/Excel.

Retention moats:

- Historical recipes, stock variance, vendor price trends, customer profiles, campaign response, forecast accuracy.
- The more daily stock counts and customer visits captured, the harder it becomes to leave.

## 11. Priority Matrix

Critical:

- Tenant/outlet/business-day schema.
- Immutable audit log.
- Stock ledger replacing direct stock mutation.
- RBAC permissions beyond owner/employee.
- Business-day close and shift model.
- Petty-cash date bug fix.
- Timezone correctness.
- Soft deletes and reason capture.
- Offline queue foundation.

High value:

- Purchase/vendor/GRN workflow.
- Batch/expiry tracking.
- Wastage workflow.
- Recipe costing/versioning.
- Stock variance dashboard.
- Predictive reorder.
- Customer profile + consent + WhatsApp campaigns.
- Aggregator reconciliation.
- Materialized analytics facts.

Medium value:

- Websocket live dashboards.
- Staff performance dashboard.
- AI health score.
- Menu engineering redesign.
- Mobile owner cockpit.
- Device management.

Nice to have:

- Self-order kiosks.
- QR ordering.
- Loyalty wallet.
- Instagram integration.
- Natural-language analytics.
- Benchmarking across cafés.

## 12. Execution Roadmap

### MVP Hardening: 2-4 Weeks

- Add `business_day` abstraction and IST-safe date handling.
- Fix purchases backend so selected dates work, not only today.
- Add soft delete, edit/delete reasons, and audit log for inventory, recipes, purchases, banking, misc payments, routines, customers.
- Add permission matrix and route guards for inventory/recipe/routine/menu/purchase/banking mutation.
- Remove or archive unused legacy frontend pages.
- Add API pagination and date ranges to list endpoints.
- Add basic materialized daily metrics collection.
- Add data contracts: `PRODUCT.md`, `DESIGN.md`, API schema docs, DB schema docs.

### Phase 1: Inventory Operating System: 4-8 Weeks

- Introduce stock ledger and inventory balances.
- Convert recipe/routine/adjustment/purchase stock changes to ledger events.
- Convert movement grid into count submission and variance workflow.
- Add wastage events.
- Add vendors, goods receipts, purchase invoices.
- Add unit conversion and base units.
- Add batch/expiry for milk, bakery, beans, syrups.
- Build milk/bean/packaging variance dashboard.
- Build daily close workflow.

### Phase 2: Café Intelligence: 8-12 Weeks

- Recipe costing and margin snapshots.
- Menu profitability dashboard.
- Predictive reorder by vendor and item.
- Low-stock alerts based on forecast, not static min quantity.
- Customer profile store, RFM segments, lapsed regulars.
- WhatsApp campaign/export hooks.
- Staff shift scorecards.
- Aggregator reconciliation upload/import.
- AI daily insights feed with rupee impact.

### Later Roadmap: Chain, Franchise, And Multi-Outlet

Do not build these in the first execution cycle. Keep the schema extensible, but do not spend product or UI effort here until independent/single-outlet cafés are retained and paying.

- Tenant/outlet/brand/region hierarchy.
- Central menu and recipe management.
- Central kitchen dispatch and inter-outlet transfers.
- HQ dashboards and outlet leaderboard.
- Franchise audit pack.
- API keys and webhook subscriptions.
- Integration marketplace skeleton.
- Multi-outlet data warehouse.

## 13. Market Readiness Scores

- Product workflow depth: 38/100.
- Inventory maturity: 32/100.
- Analytics maturity: 45/100.
- SaaS architecture: 22/100.
- Security/RBAC/audit: 25/100.
- UI/UX for owner: 58/100.
- UI/UX for employee tablet/mobile: 36/100.
- Café specificity: 55/100.
- Competitive readiness vs Petpooja for independent cafés: 36/100.
- Potential after focused single-café inventory intelligence roadmap: 82/100.
- Chain/franchise readiness: deferred, not scored as a current goal.

## 14. Immediate Build Order

Build first:

1. Business day, audit log, RBAC, soft delete, reason capture.
2. Stock ledger and stock count workflow.
3. Purchases/vendor/GRN replacing petty-cash-only purchases.
4. Wastage and variance dashboards for milk/beans/packaging.
5. Daily close workflow.
6. Predictive reorder and low-stock alerts.
7. Customer profile/retention layer.
8. Aggregator reconciliation.
9. Offline sync.
10. Petpooja/Excel imports and owner WhatsApp digest.

Biggest competitive advantage:

- Café-specific inventory variance and AI reorder. Petpooja is broad; Deja Brew can become sharper for cafés.

Fastest revenue:

- Inventory advanced pack, WhatsApp alerts, aggregator reconciliation, daily close, vendor purchase system.

Best retention:

- Stock history, customer profiles, vendor price trends, recipe costing, campaign history, and daily close records.

Biggest valuation unlock:

- Proprietary café operating intelligence dataset from single-outlet cafés first; multi-outlet expansion later becomes easier once the daily operating workflow is trusted.

## 15. Master Implementation Checklist

This is the point-by-point implementation backlog required to turn Deja Brew ERP into the café-first product originally envisioned: a market-ready operating system for independent and single-outlet cafés that can compete with Petpooja by winning on café profitability, inventory discipline, owner intelligence, and offline reliability. POS replacement remains secondary for now. Chain/franchise/multi-outlet expansion is deliberately deferred.

### 15.1 Strategic Product Positioning

- Position the product as a café profit and operations intelligence layer, not just ERP and not only POS.
- Make the first market wedge: "Find café leakage, improve margins, close the day faster, and predict what to buy."
- Allow cafés to use Deja Brew even if they already use Petpooja, Square, Toast, Loyverse, Excel, or manual registers.
- Build import-first workflows before forcing full migration.
- Treat POS as an expansion module, not the first battlefield.
- Build for specialty cafés, QSR cafés, bakery cafés, cloud cafés, and owner-operated single outlets first.
- Prioritize owners doing ₹3L to ₹30L monthly revenue from one outlet.
- Prioritize cafés with high milk, bean, bakery, packaging, and aggregator leakage risk.
- Product promise: "Close your café in 6 minutes and know exactly where money and stock leaked."
- Avoid broad restaurant positioning in early GTM.
- Avoid generic "restaurant ERP" messaging.
- Avoid competing with Petpooja on feature count.
- Compete on café-specific intelligence, simplicity, and trust.

### 15.2 Core Architecture Foundation

- Add `tenant_id` to every collection.
- Add `outlet_id` internally with a default primary outlet, but do not build multi-outlet UI yet.
- Add `business_day_id` to every operational transaction.
- Add `shift_id` to staff actions, stock actions, cash actions, and close-day workflows.
- Add `device_id` to all offline-capable actions.
- Add `created_by`, `created_by_name`, `created_at`, `updated_by`, `updated_at` consistently.
- Add soft-delete fields: `deleted_at`, `deleted_by`, `delete_reason`.
- Add immutable audit events for every create, update, delete, adjustment, close, approval, sync, and export.
- Add API versioning, starting with `/api/v1`.
- Add typed backend response envelopes for success, validation errors, conflict errors, and sync errors.
- Add request IDs and structured logs.
- Add idempotency keys to all mutation endpoints.
- Add a service/domain layer between routers and MongoDB.
- Add repository helpers for tenant and default-outlet filters.
- Add route-level permission checks.
- Add schema documentation for every collection.
- Add backend tests for every mutation side effect.
- Add data migration scripts instead of startup-only ad hoc migrations.

### 15.3 Business Day And Timezone

- Implement a `business_days` collection.
- Define outlet timezone explicitly, default `Asia/Kolkata`.
- Stop using raw UTC date strings for operational day decisions.
- Store `business_date` separately from `created_at`.
- Allow configurable day close time for cafés operating after midnight.
- Add open-day and close-day states.
- Prevent risky edits after day close unless manager/owner reopens the day.
- Add close-day lock rules by module.
- Add reopening audit trail.
- Add daily close snapshot immutable record.

### 15.4 Offline-First System

- Add PWA app shell support so the app loads without internet.
- Add IndexedDB local database using Dexie or equivalent.
- Add stable `device_id` per browser/tablet.
- Add `device_sessions` backend collection.
- Add frontend command outbox table.
- Store offline commands with `id`, `type`, `payload`, `entity_type`, `entity_id`, `status`, `created_at`, `user_id`, `device_id`.
- Add `/api/sync/bootstrap` for initial device data.
- Add `/api/sync/push` for pending command upload.
- Add `/api/sync/pull?since=` for server changes.
- Add `sync_commands` collection with unique `command_id`.
- Make every offline mutation idempotent.
- Add conflict detection for same entity/field edits.
- Add conflict UI for unresolved sync conflicts.
- Add latest-write-wins only for safe fields such as inventory movement draft cells.
- Add manager-review conflict rules for cash, stock adjustment, and day-close data.
- Cache menu, recipes, inventory master, routines, users, and outlet settings for offline read.
- Enable offline write first for inventory movement.
- Enable offline write second for walk-ins.
- Enable offline write third for routine execution.
- Enable offline write fourth for purchases and wastage after audit ledger exists.
- Enable offline banking only with strict sync and day-close rules.
- Add global online/offline indicator.
- Add pending sync count in employee layout.
- Add per-row status: synced, pending, failed, conflict.
- Add retry failed sync button.
- Add "last synced at" timestamp.
- Add sync diagnostics page for managers.
- Add device revoke capability for owner.
- Add offline-safe local sequence numbers for device-generated documents.
- Add app version checks during sync.
- Add server rejection reasons surfaced in UI.

### 15.5 RBAC, Security, And Abuse Prevention

- Replace owner/employee-only authorization with permission-based RBAC.
- Add roles: owner, manager, shift supervisor, cashier, barista, kitchen staff, inventory manager, accountant, auditor, and support agent.
- Add permission actions for inventory, recipes, purchases, vendors, cash, reports, users, settings, and audit.
- Require manager PIN for risky actions.
- Require reason capture for stock adjustment, cash deletion, bill edit, purchase deletion, recipe change, vendor change, and day reopen.
- Add suspicious action feed.
- Add failed login tracking.
- Add rate limiting for auth endpoints.
- Add password reset workflow.
- Add optional 2FA for owners and managers.
- Add user active/inactive status instead of hard delete.
- Add session revoke.
- Add device revoke.
- Add data export permissions.
- Add audit export permissions.
- Add field-level restrictions for staff.
- Add owner-only financial settings.
- Add support impersonation only with explicit audit trail.

### 15.6 Inventory Master

- Split inventory into item master and outlet balances.
- Add base unit to every item.
- Add purchase unit and recipe unit conversion.
- Add unit conversion table.
- Add item type: raw material, semi-finished, packaging, cleaning, consumable, retail item.
- Add critical stock flag.
- Add perishable flag.
- Add batch-tracked flag.
- Add expiry-tracked flag.
- Add lot-tracked flag.
- Add preferred vendor.
- Add reorder lead time.
- Add safety stock.
- Add minimum display stock.
- Add storage location.
- Add tax category if purchases need accounting.
- Add active/inactive item state.
- Add duplicate item prevention.
- Add import from Excel for inventory master.
- Add item merge workflow.

### 15.7 Stock Ledger And Balances

- Create immutable `stock_ledger` collection.
- Create derived `inventory_balances` collection.
- Stop mutating `inventory.current_stock` as source of truth.
- Convert recipe deduction into ledger events.
- Convert routine execution into ledger events.
- Convert purchase receipt into ledger events.
- Convert wastage into ledger events.
- Convert stock adjustment into ledger events.
- Convert internal transfer into ledger events.
- Convert stock count variance into ledger events after approval.
- Add event types: purchase_received, sale_consumed, routine_consumed, waste, adjustment, transfer_out, transfer_in, count_correction, expiry_writeoff, staff_meal, sample, return_to_vendor.
- Add source references to every ledger event.
- Add before/after balance snapshot on ledger projection.
- Add stock ledger rollback only through compensating events.
- Add balance rebuild job.
- Add stock ledger integrity checks.
- Add negative stock policy by item.
- Add stock reservation for future online ordering if needed later.

### 15.8 Inventory Movement Tracker Upgrade

- Convert current OPEN/NEW/USED/CLOSE grid into a stock count and variance workflow.
- Keep the familiar grid UI because it matches real café stock sheets.
- Replace manual "USED" as final truth with theoretical vs actual comparison.
- Show theoretical used from recipe and routine ledger.
- Show counted used from OPEN + NEW - CLOSE.
- Show variance quantity.
- Show variance percentage.
- Show variance value in rupees.
- Highlight milk, beans, cups, lids, bakery, syrups, and high-cost items.
- Add section-level filters: Barista, Kitchen, Packaging, Cleaning, Retail.
- Add daily count submit action.
- Add manager approval for large variance.
- Add variance reasons: spill, over-pour, staff meal, spoilage, wrong order, expired, theft suspected, count error, transfer missing.
- Add photo attachment for wastage/count proof.
- Add stock count lock after day close.
- Add stock count reopen workflow.
- Add monthly export matching café stock sheet format.

### 15.9 Batch, Lot, And Expiry Tracking

- Add `stock_lots` collection.
- Track vendor, invoice, received date, expiry date, roast date, batch number, unit cost.
- Support FIFO or weighted-average costing.
- Track milk batch expiry.
- Track bakery sell-by date.
- Track coffee bean roast date and freshness window.
- Track syrup/sauce expiry.
- Add expiry risk dashboard.
- Add items expiring soon alert.
- Add forced write-off flow for expired stock.
- Add markdown/promotion suggestion for bakery nearing expiry.
- Add lot-level wastage.
- Add lot-level recall lookup.

### 15.10 Recipe And Costing Engine

- Add recipe versioning.
- Store recipe versions with effective date.
- Keep historical bills linked to recipe cost snapshot.
- Add ingredient yield loss.
- Add preparation loss.
- Add milk steaming/foam loss.
- Add grinder calibration waste.
- Add packaging cost per channel.
- Add channel-specific recipe cost if packaging differs by Swiggy/Zomato/takeaway/dine-in.
- Add semi-finished recipes such as cold brew concentrate, sauces, batters, pre-mixes.
- Add batch production recipes.
- Add recipe margin calculation.
- Add recipe cost trend over time.
- Add menu item contribution margin.
- Add ideal selling price suggestion.
- Add low-margin item warning.
- Add recipe completeness score.
- Add menu availability dependency on stock.
- Add "how many cups can we sell from current stock" calculator.

### 15.11 Milk, Coffee Beans, And Café-Critical Tracking

- Add milk-specific dashboard.
- Track milk opening, received, theoretical used, actual used, closing, variance.
- Track milk by vendor and fat type if needed.
- Track milk spoilage separately from usage.
- Add milk consumption forecast.
- Add milk reorder recommendation.
- Add bean-specific dashboard.
- Track beans by roast date, vendor, blend, grinder, and batch.
- Track grams per beverage recipe.
- Track grinder calibration routine deductions.
- Track bean expected vs actual variance.
- Add coffee yield dashboard.
- Track cups/lids/straws/packaging expected vs actual.
- Track bakery expiry and waste.
- Track syrup bottle yields.
- Track ice cream/base mix for cold beverages.

### 15.12 Purchases, Vendors, And GRN

- Replace petty-cash-only purchases with purchase workflows.
- Keep petty cash as payment source, not inventory source.
- Add suppliers/vendors collection.
- Add vendor contacts, payment terms, GSTIN, category, lead time.
- Add purchase order creation.
- Add goods receipt note.
- Add supplier invoice attachment.
- Add received quantity vs ordered quantity.
- Add accepted/rejected quantity.
- Add return-to-vendor workflow.
- Add vendor price history.
- Add vendor reliability score.
- Add vendor-wise spend dashboard.
- Add purchase approval rules.
- Add recurring purchase templates.
- Add smart purchase list generated from reorder recommendations.
- Add cash/UPI/bank payment tracking.
- Add purchase due payments.
- Add vendor aging report.
- Fix existing float expense date behavior.

### 15.13 Wastage And Leakage

- Add wastage module.
- Add waste event types: spoilage, expired, staff meal, customer return, wrong order, spillage, over-prep, sample, machine test, damaged packaging.
- Add item, quantity, unit, value, reason, staff, shift, photo, notes.
- Add expected vs actual wastage.
- Add waste by item dashboard.
- Add waste by reason dashboard.
- Add waste by staff/shift dashboard.
- Add high-waste alerts.
- Add wastage trend forecast.
- Add suggested operational fixes.
- Add daily close requirement: critical wastage must be confirmed.

### 15.14 Daily Close Workflow

- Add "Close Day" as the central café workflow.
- Include sales summary.
- Include online sales summary.
- Include cash expected.
- Include UPI expected.
- Include aggregator expected.
- Include petty cash spent.
- Include banking handover.
- Include critical stock closing counts.
- Include wastage confirmation.
- Include staff notes.
- Include unresolved sync items.
- Include suspicious action review.
- Include variance approvals.
- Include next-day purchase recommendations.
- Generate immutable close snapshot.
- Generate close PDF.
- Send owner WhatsApp/email close summary.
- Prevent next-day open if previous day has critical unresolved items, configurable by owner.

### 15.15 Aggregator And Online Sales

- Replace manual online sales summaries with platform order/reconciliation model.
- Add platform accounts: Swiggy, Zomato, District, Magicpin, ONDC if needed.
- Add manual CSV import for platform settlements first.
- Add aggregator order import.
- Add payout import.
- Add commission, GST/TCS/TDS, platform discount, merchant discount, packaging fee, cancellation fee, refund, ads spend.
- Add gross-to-net reconciliation.
- Add missing payout alert.
- Add high cancellation alert.
- Add platform profitability by item.
- Add platform-specific packaging cost.
- Add item availability sync later.
- Add integration connector later after CSV workflow is stable.

### 15.16 Customer Profiles And Retention

- Promote derived customers into a `customer_profiles` collection.
- Add phone normalization.
- Add duplicate merge.
- Add consent tracking for WhatsApp/SMS/email.
- Add visit recency/frequency/monetary segmentation.
- Add favorite items.
- Add average spend.
- Add visit rhythm.
- Add lapsed regular detection.
- Add birthday/anniversary fields optionally.
- Add customer tags.
- Add loyalty points ledger.
- Add prepaid wallet later.
- Add subscription coffee plans.
- Add campaign history.
- Add coupon redemption tracking.
- Add campaign ROI.
- Add WhatsApp export first, automation later.
- Add DPDP-compliant consent and opt-out handling.

### 15.17 Owner Intelligence Dashboard

- Add daily café health score.
- Add sales vs forecast.
- Add margin vs target.
- Add cash variance.
- Add stock variance.
- Add wastage value.
- Add repeat customer rate.
- Add low-stock risk.
- Add purchase due list.
- Add staff exceptions.
- Add online payout exceptions.
- Add "what needs attention today" feed.
- Add "what to buy today" card.
- Add "where money leaked yesterday" card.
- Add "items to push today" card.
- Add "items to pause today" card.
- Add mobile-first owner cockpit.
- Add WhatsApp daily digest.
- Add voice/natural-language question interface later.

### 15.18 Analytics And Data Layer

- Create materialized daily facts.
- Add `daily_sales_summary`.
- Add `daily_item_sales`.
- Add `daily_stock_summary`.
- Add `daily_customer_summary`.
- Add `daily_staff_summary`.
- Add `daily_cash_summary`.
- Add `daily_vendor_summary`.
- Add `stock_variance_facts`.
- Add scheduled aggregation job.
- Add rebuild analytics job.
- Add report cache.
- Add export jobs for large reports.
- Add report pagination.
- Add metric definitions catalog.
- Add consistent metric naming.
- Add gross sales, net sales, discount, tax, service charge, channel fees, COGS, gross margin, contribution margin.
- Add outlet comparison metrics later.

### 15.19 AI Systems

- Add rule-based insights before ML.
- Add demand forecasting.
- Add milk consumption forecasting.
- Add bean variance detection.
- Add packaging variance detection.
- Add reorder recommendations.
- Add theft/suspicious adjustment detection.
- Add employee behavior anomaly detection.
- Add menu profitability recommendations.
- Add dead item detection.
- Add lapsed customer prediction.
- Add peak-hour forecasting.
- Add staffing recommendations.
- Add wastage prediction.
- Add vendor price anomaly detection.
- Add aggregator payout anomaly detection.
- Add AI-generated daily owner summary.
- Add AI café health score explanation.
- Add AI insight feedback: useful, not useful, resolved.
- Add model evaluation against actual outcomes.
- Add safe metric API for natural-language analytics.
- Do not allow LLM direct unrestricted DB access.

### 15.20 Staff, Shifts, And Accountability

- Add shifts.
- Add shift open and shift close.
- Add staff attendance.
- Add staff roles per outlet.
- Add staff PIN.
- Add staff action logs.
- Add cash drawer assignment.
- Add stock count assignment.
- Add task checklist assignment.
- Add routine compliance tracking.
- Add late/missed routine alerts.
- Add staff performance dashboard.
- Add staff cash variance.
- Add staff stock variance correlation.
- Add staff discount/edit/delete patterns.
- Add manager approval flow.

### 15.21 Routines, SOPs, And Maintenance

- Upgrade routines into SOP checklists.
- Add recurring schedules.
- Add due windows.
- Add mandatory routines for open/close.
- Add espresso machine cleaning logs.
- Add grinder calibration logs.
- Add water filter replacement reminders.
- Add refrigerator temperature logs.
- Add machine breakdown logs.
- Add AMC/vendor maintenance contacts.
- Add downtime impact notes.
- Add compliance checklist.
- Add photo proof for critical routines.
- Add missed routine alerts.

### 15.22 Deferred Later: Multi-Outlet And Franchise

- Do not build this module in the first market-capture phase.
- Keep `tenant_id` because the product is still SaaS.
- Keep a default `outlet_id` internally so future expansion does not require a schema rewrite.
- Do not build brand/region/franchise grouping yet.
- Do not build HQ dashboards yet.
- Do not build outlet leaderboard yet.
- Do not build central kitchen yet.
- Do not build inter-outlet transfers yet.
- Do not build franchise audit score yet.
- Do not build consolidated multi-outlet reporting yet.
- Do not build tenant-wide/region-wide role scopes yet.
- Revisit this only after single-outlet cafés have reliable daily close, inventory variance, offline sync, customer retention, and paid usage.
- Future phase items: tenant/outlet hierarchy, centralized menu, outlet-specific pricing, central recipes, stock transfers, central kitchen, franchise SOP compliance, vendor contract pricing, consolidated reporting, outlet benchmarking.

### 15.23 Integrations And Imports

- Add Petpooja export import.
- Add Excel stock sheet import.
- Add menu import.
- Add bill/sales import.
- Add customer import.
- Add Swiggy/Zomato settlement CSV import.
- Add bank statement CSV import later.
- Add Tally export later.
- Add WhatsApp provider integration.
- Add email provider integration.
- Add SMS provider integration if needed.
- Add webhook framework.
- Add API keys.
- Add integration logs.
- Add retry and failure monitoring.
- Add app marketplace later.

### 15.24 Hardware And Device Readiness

- Add tablet-first responsive employee UI.
- Add mobile owner cockpit.
- Add printer configuration model.
- Add thermal printer support tracking.
- Add printer health/status if possible.
- Add KDS later.
- Add customer-facing display later.
- Add barcode/QR scanner support for inventory later.
- Add device registry.
- Add device assignment to the primary café outlet internally.
- Add device sync status.
- Add device last seen.
- Add kiosk/QR ordering later only after operations layer is strong.

### 15.25 UI/UX Redesign Points

- Replace broad employee sidebar with role/task-based navigation.
- Add Today workspace for employees.
- Add Manager workspace for approvals and exceptions.
- Add Owner cockpit for mobile.
- Reduce modal dependency in repeated workflows.
- Add inline editing where safe.
- Add undo only through audited compensating actions.
- Add clear empty states for first-time setup.
- Add guided setup wizard.
- Add sticky sync status.
- Add tablet-friendly touch targets.
- Add compact dense tables for owner/admin.
- Add large fast controls for staff.
- Add offline/pending/error states everywhere.
- Add row-level action history.
- Add confirmation for destructive actions.
- Add reason capture UI.
- Add visual distinction between draft, pending sync, approved, rejected, closed.

### 15.26 Setup, Onboarding, And Migration

- Add onboarding checklist.
- Add café profile setup.
- Add tax/settings setup.
- Add user/role setup.
- Add inventory master import.
- Add opening stock import.
- Add menu import.
- Add recipe setup wizard.
- Add vendor setup.
- Add critical stock selection.
- Add daily close setup.
- Add WhatsApp alert setup.
- Add first 14-day variance report.
- Add migration from current Mongo schema.
- Add sample café demo data.
- Add guided owner training content.

### 15.27 Compliance, Finance, And Reporting

- Add GST-friendly report exports.
- Add tax summary by date range.
- Add cash/UPI/bank reconciliation.
- Add aggregator payout reconciliation.
- Add purchase invoice report.
- Add vendor payable report.
- Add inventory valuation report.
- Add wastage valuation report.
- Add stock adjustment report.
- Add audit trail report.
- Add user activity report.
- Add close-day report.
- Add downloadable accountant pack.
- Add DPDP consent reporting for customers.
- Add FSSAI/AMC/document reminder tracker later.

### 15.28 DevOps, Quality, And Observability

- Add backend unit tests for domain services.
- Add integration tests for stock ledger.
- Add sync conflict tests.
- Add offline E2E tests with network disabled.
- Add Playwright tests for tablet/mobile layouts.
- Add visual regression tests for critical screens.
- Add migration tests.
- Add load tests for dashboard analytics.
- Add structured logging.
- Add Sentry or equivalent frontend/backend error tracking.
- Add health checks for DB and worker.
- Add queue monitoring.
- Add backup and restore documentation.
- Add seed/demo data scripts.
- Add CI checks.
- Add deployment runbooks.
- Add environment variable documentation.

### 15.29 Packaging And Monetization

- Create Starter plan: daily close, inventory movement, basic dashboards.
- Create Growth plan: AI reorder, wastage, WhatsApp alerts, customer retention.
- Defer Multi-Outlet plan until the single-outlet product is retained and paid.
- Defer Enterprise plan until integrations, API, audit exports, custom roles, and support workflows have real demand.
- Add paid onboarding/setup.
- Add recipe setup service.
- Add data migration service.
- Add WhatsApp/SMS credits.
- Add aggregator reconciliation add-on.
- Add advanced inventory add-on.
- Add AI insights add-on.
- Defer franchise command center add-on.

### 15.30 Immediate Engineering Order

- Fix date handling and business-day foundation.
- Add audit log and soft deletes.
- Add RBAC permissions.
- Add device identity and IndexedDB outbox foundation.
- Add sync endpoints.
- Convert inventory movement to offline-first.
- Convert walk-ins to offline-first.
- Add stock ledger and inventory balances.
- Convert recipe/routine deductions to stock ledger.
- Add wastage module.
- Add vendor and purchase receipt module.
- Add daily close workflow.
- Add variance dashboard.
- Add reorder recommendations.
- Add owner WhatsApp digest.
- Add Petpooja/Excel import.
- Add customer profile store.
- Add aggregator reconciliation.
- Defer multi-outlet hierarchy.

### 15.31 Definition Of "Market-Ready"

- A café can onboard without developer intervention.
- A café can operate during internet failure.
- A café can close the day with cash, stock, wastage, purchases, and alerts reconciled.
- Owner can see why profit leaked, not only how much revenue happened.
- Inventory can be trusted because every stock change has a reason, actor, source, and audit event.
- Milk, beans, packaging, and bakery variance are visible daily.
- Purchase recommendations are generated from forecast and stock, not static min quantity.
- Staff actions are attributable and reviewable.
- Reports are exportable for accountant/owner.
- Multi-device sync does not duplicate or lose actions.
- Single-outlet production readiness exists, with `tenant_id` and default `outlet_id` present internally for later expansion.
- Customer data has consent and repeat behavior tracking.
- The product can coexist with Petpooja through imports before replacing anything.

## 16. Source Links

- Petpooja POS: https://www.petpooja.com/poss
- Petpooja inventory: https://www.petpooja.com/inventory-management-system
- Petpooja scan/order: https://www.petpooja.com/scan-and-order
- Petpooja marketplace: https://www.petpooja.com/restaurant-app-marketplace
- Restroworks platform/franchise: https://www.restroworks.com/restaurant-franchise-management-software/
- Restroworks inventory: https://www.restroworks.com/restaurant-inventory-management-software/
- Restroworks recipe: https://www.restroworks.com/restaurant-recipe-management-software/
- Posist enterprise: https://www.posist.com/restaurant-enterprise-software/
- Posist platform: https://www.posist.com/platform/
- Posist BOH: https://www.posist.com/back-of-house/
- Toast products: https://pos.toasttab.com/products
- Toast reporting: https://pos.toasttab.com/products/reporting
- Toast inventory: https://pos.toasttab.com/products/inventory-management
- Toast KDS: https://pos.toasttab.com/hardware/kitchen-display-system
- Square Restaurants features: https://squareup.com/us/en/point-of-sale/restaurants/features
- Square online ordering: https://squareup.com/us/en/online-ordering
- Shopify POS features: https://www.shopify.com/pos/features
- Loyverse features: https://loyverse.com/features
- Oracle Simphony analytics: https://www.oracle.com/food-beverage/restaurant-pos-systems/restaurant-analytics/
