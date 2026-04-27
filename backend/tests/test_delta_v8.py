"""Delta v8 backend smoke tests:
   - POST /api/bills (used by Submit + Print Bill / Submit + KOT)
   - POST/DELETE /api/misc-payments (owner & employee CRUD share same endpoints)
   - POST /api/float/expenses (multi-day seeding) + GET /api/float/history (Daily Float History expansion data)
"""
import os
from datetime import datetime, timedelta, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://deja-brew-erp.preview.emergentagent.com").rstrip("/")
OWNER = {"email": "owner@dejabrew.com", "password": "BrewOwner2024"}


@pytest.fixture(scope="module")
def owner_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth(owner_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"})
    return s


# ---- Bills (Submit + Print Bill / KOT) ----
def test_post_bill_minimal(auth):
    # fetch a menu item
    r = auth.get(f"{BASE_URL}/api/menu?active_only=true", timeout=15)
    assert r.status_code == 200
    items = r.json()
    if not items:
        pytest.skip("No menu items available")
    it = items[0]
    payload = {
        "customer_name": "TEST_v8_print",
        "customer_phone": None,
        "items": [{"menu_item_id": it["id"], "name": it["name"], "price": it["price"], "quantity": 1, "item_discount_pct": 0}],
        "overall_discount": 0,
        "payment_mode": "cash",
        "cash_amount": it["price"] * 1.05,
        "upi_amount": 0,
    }
    r = auth.post(f"{BASE_URL}/api/bills", json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert "bill_number" in data
    assert "total" in data
    assert data["customer_name"] == "TEST_v8_print"


# ---- Misc Payments owner CRUD ----
def test_misc_payment_create_and_delete(auth):
    today = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")
    payload = {
        "amount": 99.5,
        "source": "TEST_v8_owner",
        "category": "Tips",
        "payment_mode": "cash",
        "notes": "owner page CRUD test",
        "date": today,
    }
    r = auth.post(f"{BASE_URL}/api/misc-payments", json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    created = r.json()
    pid = created["id"]
    assert created["amount"] == 99.5
    assert created["source"] == "TEST_v8_owner"

    # GET by date and verify in list
    r2 = auth.get(f"{BASE_URL}/api/misc-payments?date_str={today}", timeout=15)
    assert r2.status_code == 200
    assert any(e["id"] == pid for e in r2.json())

    # DELETE
    r3 = auth.delete(f"{BASE_URL}/api/misc-payments/{pid}", timeout=15)
    assert r3.status_code in (200, 204), r3.text

    # Verify gone
    r4 = auth.get(f"{BASE_URL}/api/misc-payments?date_str={today}", timeout=15)
    assert all(e["id"] != pid for e in r4.json())


# ---- Float expenses for multi-day history (DPurchases expandable rows) ----
def test_float_expenses_today_and_history(auth):
    cats = ["Raw Materials", "Consumables", "Utilities", "Staff", "Maintenance", "Other"]
    created_ids = []
    for i, cat in enumerate(cats[:3]):
        r = auth.post(
            f"{BASE_URL}/api/float/expenses",
            json={"description": f"TEST_v8_float_{cat}", "category": cat, "amount": 25 + i},
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        created_ids.append(r.json().get("id"))

    r = auth.get(f"{BASE_URL}/api/float/history", timeout=15)
    assert r.status_code == 200
    history = r.json()
    assert isinstance(history, list)
    # today should be present with at least our 3 items
    today = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")
    today_rec = next((h for h in history if h.get("date") == today), None)
    assert today_rec is not None, "today record missing in /float/history"
    descs = [e.get("description", "") for e in today_rec.get("expenses", [])]
    assert any("TEST_v8_float_" in d for d in descs)
