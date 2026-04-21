# Deja Brew ERP — Changelog

## 2026-02-21 — Delta v3 (Void + DatePicker + CSV Exports)
- **Void ownership transferred to employees**: Backend `/api/bills/{id}/void` no longer requires `owner` role; any authenticated user can void.
- **New page** `/entry/bills` (Bills.jsx) — lists day's bills, view detail modal, void with inventory-restoration confirmation modal.
- **Void removed from Owner Dashboard** `/dashboard/billing` — now purely read-only (view detail + voided badge + CSV export).
- **Shadcn ThemeDatePicker** (`components/ThemeDatePicker.jsx`) — replaces native `<input type="date">` on Walk-ins / Purchases / Entry Bills / Owner Billing / DateRangeToolbar (Custom tab).
- **CSV export** added to Overview, Sales, and Billing dashboards (`utils/csv.js`).
- Tests: 6/6 delta pytest + frontend Playwright (iteration_3.json). 100% pass.

## 2026-02-20 — V2 Architecture Pivot
- Split into `/entry/*` (Employee) and `/dashboard/*` (Owner) with RoleRedirect + OwnerRoute.
- Created Routines (machine testing etc. with auto-inventory deduction) and Menu Management (recipe-mapped ingredients).
- Owner Dashboards: Overview, Walk-ins, Sales, Purchases, Inventory, Billing, Banking, Settings.
- DateRangeToolbar: Today / 7 Days / This Month / Custom range.
- Banking module (Owner-only cash handovers log).
- Recipe-driven inventory deduction on bill POST; void reverses deductions.
- Tests: 35/35 backend + full frontend E2E (iteration_2.json). 100% pass.

## 2026-02-19 — V1 MVP
- Auth (JWT cookies, owner seed).
- Walk-ins, Billing, Inventory, Menu, Petty Cash Float (₹5200), Owner Dashboard stats.
- Tests: iteration_1.json. 100% pass.
