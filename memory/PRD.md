# Deja Brew ERP — Product Requirements (PRD)

## Original Problem Statement
Build a complete ERP system for cafe "Deja Brew" with:
- Two roles: Employee (operational data entry) and Owner (analytics + insights)
- Modules: Walk-ins · Unified Sales (offline + Swiggy/Zomato/District) · Purchases (₹5200 petty-cash float) · Inventory (Barista/Kitchen sections) · Billing (Cash/UPI split, 2.5% CGST + 2.5% SGST) · Routines (e.g. machine testing) · Menu Management (with recipe-driven ingredient mapping) · Banking (cash handovers) · Owner Dashboards.
- System Logic: No approval flow (all entries final), Recipe-driven inventory deduction (auto on billing + routines), Void bill reverses deductions.
- Theme: Coffee warm themed UI.

## Architecture (V2)
- Backend: FastAPI + MongoDB (motor/async), JWT cookie auth.
  - Routers: `auth`, `walkins`, `menu`, `bills`, `inventory`, `float`, `dashboard`, `users`, `recipes`, `online-sales`, `routines`, `banking`
- Frontend: React + React Router, axios (withCredentials), Shadcn UI, recharts, sonner, lucide-react.
  - Separated layouts: `EntryLayout` (/entry/*) and `DashboardLayout` (/dashboard/*).
  - Role-based redirection via `RoleRedirect` at `/` and `OwnerRoute` wrapper on `/dashboard/*`.

## Key Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/auth/login | Email+password, sets cookies |
| POST | /api/auth/register | Owner-only, creates users |
| GET | /api/auth/me | Current user |
| POST | /api/bills | Create bill, auto-deducts recipe ingredients |
| POST | /api/bills/{id}/void | Owner-only, reverses inventory deductions |
| POST | /api/routines/{id}/execute | Deducts ingredients, logs execution |
| POST | /api/recipes | Upsert recipe (menu_item_id → ingredients) |
| GET | /api/dashboard/analytics?from_date=&to_date= | Range rollup |
| GET/POST/DELETE | /api/banking | Owner-only cash handovers |

## Completed (Feb 2026)
- V1 MVP: base models, login, seed owner, walk-ins, billing, inventory, float, menu, dashboard (DONE)
- V2 Pivot (all DONE and E2E tested):
  - Separate `/entry/*` Employee and `/dashboard/*` Owner routes
  - Role-based redirect on login
  - Recipe-driven inventory deduction on bill POST
  - Void bill restores deductions
  - Routines with ingredient mapping + execution log
  - Menu Management with recipe modal (inventory dropdown)
  - Banking (Owner-only cash-handover log)
  - Owner Dashboards: Overview, Walk-ins, Sales, Purchases, Inventory, Billing+Void, Banking, Settings
  - DateRangeToolbar (Today/7Days/Month/Custom)
  - Settings → user management (create/delete employees and owners)

## Test Status
- `/app/test_reports/iteration_2.json`: Backend 100% (35/35 pytest), Frontend 100% (Playwright RBAC + all pages).
- Credentials: `/app/memory/test_credentials.md`.

## Roadmap (Prioritized Backlog)

### P1
- Replace native HTML date input on WalkIns/Purchases/DBilling with shadcn DatePicker for theme consistency
- Data-testid on DateRangeToolbar container (minor testability improvement)
- Login page: show seed credentials hint in dev builds
- Daily close-of-day summary report (revenue + cash expected vs deposited)

### P2
- Export reports (CSV/PDF) from Owner Dashboards
- Low-stock email/WhatsApp alerts
- Waste/spoilage tracking in inventory
- Multi-outlet support (future expansion)
- Shift-wise employee performance on Walk-ins/Billing
- Audit log of voided bills

### P3
- SMS/WhatsApp receipts to customers with phone number on bill
- Offline mode / PWA for flaky wifi
- Supplier/purchase order management (beyond petty cash)

## Data Models (MongoDB collections)
- `users` — email, name, password_hash, role (owner/employee)
- `menu_items` — name, category, price, description, active
- `recipes` — menu_item_id, menu_item_name, ingredients[]
- `inventory` — name, category, section (Barista/Kitchen/Other), current_stock, unit, min_quantity, cost_per_unit
- `bills` — bill_number, customer_name, items[], subtotal, cgst, sgst, total, payment_mode, cash/upi_amount, inventory_deductions[], is_voided
- `walkins` — num_guests, payment_mode, notes, date, time
- `online_sales` — platform (swiggy/zomato/district), gross_sales, net_sales, cash/upi/card_amount
- `float_days` — opening_balance (₹5200), expenses[], closing_balance
- `routines` — name, description, ingredients[]
- `routine_executions` — routine_id, date, executed_by, deductions[], notes
- `banking` — date, amount, depositor_name, notes
