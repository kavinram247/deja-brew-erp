# Deja Brew ERP — Changelog

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
