# Deja Brew ERP — Changelog

## 2026-02-25 — Delta v8 (Float drilldown + Owner Misc CRUD + Submit&Print)
- **Detailed float history by date** — `/dashboard/purchases` Daily Float History rows now expand inline to show that day's expense items (Time / Description / Category / Amount + Day Total).
- **Owner can manage misc payments** — `/dashboard/misc-payments` now uses the same full CRUD component as `/entry/misc-payments`. Both employee + owner can add/delete misc payments. (Removed the read-only DMiscPayments.jsx.)
- **Submit + Print buttons** — `/entry/billing` adds two new buttons next to the main Submit Bill: **"Submit + Print Bill"** and **"Submit + KOT"** that submit the bill AND auto-trigger print in one click. Plain Submit Bill still works without auto-print.
- Tests: iteration_7.json — 3/3 backend, all 8 frontend items — 100%.

## 2026-02-24 — Delta v7 (Bills page restored + Edit + Thermal Print)
- **Bills page restored at `/entry/bills`** — renamed "Customer Details" — shows full columns (bill #, name, mobile, order ₹, discount, tax, total, payment, date+time, actions). Nav entry restored.
- **Full manual edit** — every field of a bill editable (customer, items w/ price/qty/discount %, overall discount, payment mode). Backend `PUT /api/bills/{id}` reverses prior inventory deductions then re-applies new ones so stock stays net-correct.
- **Thermal Print Bill + KOT** — 80mm thermal format via CSS `@media print`. Buttons appear on new bill confirmation in `/entry/billing` and on every row in `/entry/bills`. Bill matches user's sample (Deja Brew header, address, phone, GSTIN, FSSAI, ITEM/PRICE/QTY/SUB table, CGST:2.50%/SGST:2.50%, Settlement Type, Cust mobile). KOT: token, bill no, date, QTY/Dish Name/Remarks.
- **Float 5200→5300 (per choice C)** — constant updated in v6; existing rows left alone; any new date gets ₹5300.
- New files: `PrintableReceipt.jsx`, `usePrint.js`, restored `Bills.jsx`, added thermal CSS to `App.css`.
- Tests: iteration_6.json — 8/8 backend, full frontend E2E — 100%.

## 2026-02-23 — Delta v6 (6 UX refinements)
1. **Walk-in inline on Billing** — checkbox + guest count in the customer details section of `/entry/billing`; on submit a walk-in is auto-posted alongside the bill.
2. **Float opening: ₹5200 → ₹5300**.
3. **Misc Payments module** — new `/entry/misc-payments` CRUD + `/dashboard/misc-payments` read-only view. Categories: Tips / Scrap Sale / Refund Received / Deposit Refund / Reimbursement / Other. Backend `/api/misc-payments`.
4. **Inventory: Cost/Unit removed** from add/edit form and table column (backend still accepts it with default 0.0 for backward compat).
5. **Banking: backdated entries** — date picker in Banking modal; backend accepts optional `date` field.
6. **Void feature removed** — backend endpoint, Bills.jsx, nav entry, DBilling void UI all deleted.

Tests: 13/13 backend pytest + full frontend Playwright — iteration_5.json — 100%.

## 2026-02-22 — Deployment Sync (post sandbox divergence)
- Synced sandbox to GitHub repo (user's production): Bearer-token auth, vercel.json, auth_router.py.
- Removed `emergentintegrations==0.1.0` from `requirements.txt` (not on PyPI; breaks Render).
- Locked deployment constraints in `/app/memory/DEPLOYMENT.md`.

## 2026-02-21 — Delta v4/v5 (PDF Export + Banking/Purchases refinement)
- Branded PDF export on Overview / Sales / Billing (`utils/pdf.js`).
- Banking moved to Employee side with owner read-only dashboard view.
- Purchases dashboard enhanced with itemized expense breakdown + category filter + CSV/PDF.

## 2026-02-21 — Delta v3 (Void + DatePicker + CSV)
- (Void now removed in v6.)
- Shadcn `ThemeDatePicker` replacing native date inputs.
- CSV export on Overview / Sales / Billing.

## 2026-02-20 — V2 Architecture Pivot
- Split into `/entry/*` (Employee) and `/dashboard/*` (Owner) with role-based routing.
- Recipe-driven inventory deduction on bill POST.
- Routines, Menu recipes, Banking, Owner Dashboards, DateRangeToolbar, Settings.

## 2026-02-19 — V1 MVP
- Auth, walk-ins, billing, inventory, menu, petty-cash float (₹5200 initial), owner dashboard stats.
