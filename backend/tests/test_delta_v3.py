"""Delta v3 tests: void_bill permission moved from owner-only to any auth user."""
import os
import uuid
import pytest
import requests
from pathlib import Path

# Load REACT_APP_BACKEND_URL from frontend/.env
def _base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env = Path("/app/frontend/.env").read_text()
        for line in env.splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                url = line.split("=", 1)[1].strip()
                break
    return url.rstrip("/")

BASE_URL = _base_url()
OWNER = {"email": "owner@dejabrew.com", "password": "BrewOwner2024"}
EMP = {"email": "employee@dejabrew.com", "password": "Emp12345"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def owner_session():
    return _login(OWNER)


@pytest.fixture(scope="module")
def employee_session():
    return _login(EMP)


# ===== Void permission =====
def _create_bill(session):
    # Get any menu item
    r = session.get(f"{BASE_URL}/api/menu", timeout=10)
    assert r.status_code == 200, r.text
    menu = r.json()
    assert menu, "No menu items available for test"
    item = menu[0]
    payload = {
        "customer_name": f"TEST_{uuid.uuid4().hex[:6]}",
        "items": [{
            "menu_item_id": item["id"],
            "name": item["name"],
            "price": item["price"],
            "quantity": 1,
            "item_discount_pct": 0.0,
        }],
        "overall_discount": 0,
        "payment_mode": "cash",
    }
    r = session.post(f"{BASE_URL}/api/bills", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_employee_can_void_bill(employee_session):
    bill = _create_bill(employee_session)
    assert bill["is_voided"] is False
    r = employee_session.post(f"{BASE_URL}/api/bills/{bill['id']}/void", timeout=15)
    assert r.status_code == 200, f"Employee void failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["is_voided"] is True
    assert "voided_at" in data


def test_owner_can_still_void_bill(owner_session):
    bill = _create_bill(owner_session)
    r = owner_session.post(f"{BASE_URL}/api/bills/{bill['id']}/void", timeout=15)
    assert r.status_code == 200, f"Owner void failed: {r.status_code} {r.text}"
    assert r.json()["is_voided"] is True


def test_unauthenticated_void_rejected():
    # Create a bill first (as owner) to get an id
    s = _login(OWNER)
    bill = _create_bill(s)
    # Now call void without any cookie
    r = requests.post(f"{BASE_URL}/api/bills/{bill['id']}/void", timeout=15)
    assert r.status_code in (401, 403), f"Unauth must fail, got {r.status_code}"


def test_double_void_returns_400(employee_session):
    bill = _create_bill(employee_session)
    r1 = employee_session.post(f"{BASE_URL}/api/bills/{bill['id']}/void", timeout=15)
    assert r1.status_code == 200
    r2 = employee_session.post(f"{BASE_URL}/api/bills/{bill['id']}/void", timeout=15)
    assert r2.status_code == 400


def test_bills_list_accessible_by_employee(employee_session):
    r = employee_session.get(f"{BASE_URL}/api/bills", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_void_restores_inventory(employee_session):
    # Create bill, capture deductions, void, confirm stock restored
    bill = _create_bill(employee_session)
    deductions = bill.get("inventory_deductions", [])
    if not deductions:
        pytest.skip("Menu item has no recipe / deductions to verify")

    ing_id = deductions[0]["inventory_item_id"]
    qty_deducted = deductions[0]["quantity_deducted"]

    r = employee_session.get(f"{BASE_URL}/api/inventory", timeout=10)
    assert r.status_code == 200
    inv = {i["id"]: i for i in r.json()}
    stock_before_void = inv[ing_id]["current_stock"]

    r = employee_session.post(f"{BASE_URL}/api/bills/{bill['id']}/void", timeout=15)
    assert r.status_code == 200

    r = employee_session.get(f"{BASE_URL}/api/inventory", timeout=10)
    inv_after = {i["id"]: i for i in r.json()}
    stock_after_void = inv_after[ing_id]["current_stock"]
    assert round(stock_after_void - stock_before_void, 6) == round(qty_deducted, 6), (
        f"Expected +{qty_deducted}, got delta {stock_after_void - stock_before_void}"
    )
