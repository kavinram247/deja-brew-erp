"""Delta v6 backend tests:
- Float opening 5300
- Misc Payments CRUD
- Inventory without cost_per_unit
- Banking custom date (backdated)
- Void endpoint removed
- Walk-ins POST still working (called from inline Billing)
"""
import os
import uuid
import requests
import pytest
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://deja-brew-erp.preview.emergentagent.com").rstrip("/")
OWNER_EMAIL = "owner@dejabrew.com"
OWNER_PASSWORD = "BrewOwner2024"


@pytest.fixture(scope="session")
def owner_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, f"Owner login failed: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="session")
def auth_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}


# ---- Float opening balance 5300 ----
class TestFloatOpening:
    def test_float_today_opening_5300(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/float/today", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["opening_balance"] == 5300.0, f"Expected 5300.0 got {data['opening_balance']}"


# ---- Misc Payments CRUD ----
class TestMiscPayments:
    created_id = None

    def test_create_misc_payment_no_date_defaults_today(self, auth_headers):
        payload = {
            "amount": 150.0,
            "source": "TEST_customer_tip",
            "category": "Tips",
            "payment_mode": "cash",
            "notes": "TEST v6",
        }
        r = requests.post(f"{BASE_URL}/api/misc-payments", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["amount"] == 150.0
        assert data["source"] == "TEST_customer_tip"
        assert data["category"] == "Tips"
        assert data["payment_mode"] == "cash"
        assert "id" in data
        assert "created_by_name" in data
        assert data["created_by_name"]  # not None/empty
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        assert data["date"] == today
        TestMiscPayments.created_id = data["id"]

    def test_list_by_date_includes_created(self, auth_headers):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.get(f"{BASE_URL}/api/misc-payments?date_str={today}", headers=auth_headers)
        assert r.status_code == 200
        ids = [d["id"] for d in r.json()]
        assert TestMiscPayments.created_id in ids

    def test_list_all_returns_sorted_desc(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/misc-payments/all", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) <= 200
        if len(data) > 1:
            # sorted desc by created_at
            assert data[0]["created_at"] >= data[-1]["created_at"]

    def test_create_with_custom_date(self, auth_headers):
        payload = {"amount": 50.0, "source": "TEST_backdated", "category": "Other",
                   "payment_mode": "upi", "date": "2026-01-15"}
        r = requests.post(f"{BASE_URL}/api/misc-payments", headers=auth_headers, json=payload)
        assert r.status_code == 200
        assert r.json()["date"] == "2026-01-15"
        # cleanup
        requests.delete(f"{BASE_URL}/api/misc-payments/{r.json()['id']}", headers=auth_headers)

    def test_delete_misc_payment(self, auth_headers):
        assert TestMiscPayments.created_id
        r = requests.delete(f"{BASE_URL}/api/misc-payments/{TestMiscPayments.created_id}", headers=auth_headers)
        assert r.status_code == 200
        # verify gone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r2 = requests.get(f"{BASE_URL}/api/misc-payments?date_str={today}", headers=auth_headers)
        ids = [d["id"] for d in r2.json()]
        assert TestMiscPayments.created_id not in ids

    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/misc-payments")
        assert r.status_code in (401, 403)


# ---- Inventory: cost_per_unit optional ----
class TestInventoryNoCostPerUnit:
    def test_create_inventory_without_cost_per_unit(self, auth_headers):
        payload = {
            "name": f"TEST_item_{uuid.uuid4().hex[:6]}",
            "category": "Test",
            "section": "Other",
            "current_stock": 10,
            "unit": "kg",
            "min_quantity": 2,
        }
        r = requests.post(f"{BASE_URL}/api/inventory", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["cost_per_unit"] == 0.0
        # cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{data['id']}", headers=auth_headers)


# ---- Banking with custom (backdated) date ----
class TestBankingBackdated:
    def test_banking_post_with_backdate(self, auth_headers):
        payload = {"amount": 2500.0, "depositor_name": "TEST_dep", "notes": "TEST backdated",
                   "date": "2026-01-15"}
        r = requests.post(f"{BASE_URL}/api/banking", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["date"] == "2026-01-15"
        entry_id = data["id"]
        # Verify it's fetched when filtering by that date
        g = requests.get(f"{BASE_URL}/api/banking?date_str=2026-01-15", headers=auth_headers)
        assert g.status_code == 200
        ids = [d["id"] for d in g.json()]
        assert entry_id in ids
        # cleanup
        requests.delete(f"{BASE_URL}/api/banking/{entry_id}", headers=auth_headers)

    def test_banking_post_without_date_defaults_today(self, auth_headers):
        payload = {"amount": 100.0, "depositor_name": "TEST_today"}
        r = requests.post(f"{BASE_URL}/api/banking", headers=auth_headers, json=payload)
        assert r.status_code == 200
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        assert r.json()["date"] == today
        requests.delete(f"{BASE_URL}/api/banking/{r.json()['id']}", headers=auth_headers)


# ---- Void endpoint removed ----
class TestVoidRemoved:
    def test_void_endpoint_returns_404(self, auth_headers):
        # Pick any bill id (may not exist) - endpoint itself must be gone
        fake_id = "507f1f77bcf86cd799439011"
        r = requests.post(f"{BASE_URL}/api/bills/{fake_id}/void", headers=auth_headers)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


# ---- Walk-in endpoint (invoked inline from Billing) ----
class TestWalkinsInline:
    def test_walkin_post(self, auth_headers):
        payload = {"num_guests": 2, "payment_mode": "cash", "notes": "TEST inline from billing"}
        r = requests.post(f"{BASE_URL}/api/walkins", headers=auth_headers, json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["num_guests"] == 2
        assert data["payment_mode"] == "cash"
        # cleanup if supported
        if "id" in data:
            requests.delete(f"{BASE_URL}/api/walkins/{data['id']}", headers=auth_headers)


# ---- Bill create (regression: inventory deduct still works) ----
class TestBillCreateRegression:
    def test_bill_create_still_works(self, auth_headers):
        # fetch any menu item
        menu = requests.get(f"{BASE_URL}/api/menu", headers=auth_headers)
        assert menu.status_code == 200
        items = menu.json()
        if not items:
            pytest.skip("No menu items to test bill creation")
        mi = items[0]
        payload = {
            "customer_name": "TEST_cust",
            "customer_phone": "9999999999",
            "items": [{"menu_item_id": mi["id"], "name": mi["name"], "price": mi["price"], "quantity": 1}],
            "overall_discount": 0,
            "payment_mode": "cash",
        }
        r = requests.post(f"{BASE_URL}/api/bills", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["is_voided"] is False
        assert "bill_number" in r.json()
