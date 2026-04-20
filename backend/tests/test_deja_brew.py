"""
Deja Brew ERP - Backend API Tests
Tests: auth, walkins, menu, billing, float, inventory, dashboard, users
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

OWNER_EMAIL = "owner@dejabrew.com"
OWNER_PASSWORD = "BrewOwner2024"


@pytest.fixture(scope="session")
def session_with_auth():
    """Session authenticated as owner"""
    s = requests.Session()
    resp = s.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return s


class TestAuth:
    """Auth endpoint tests"""

    def test_login_success(self):
        s = requests.Session()
        resp = s.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == OWNER_EMAIL
        assert data["role"] == "owner"

    def test_login_invalid(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": "wrongpass"})
        assert resp.status_code == 401

    def test_me_endpoint(self, session_with_auth):
        resp = session_with_auth.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == OWNER_EMAIL
        assert data["role"] == "owner"

    def test_httponly_cookies_set(self):
        s = requests.Session()
        resp = s.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert resp.status_code == 200
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies


class TestMenu:
    """Menu CRUD tests"""

    def test_get_menu(self, session_with_auth):
        resp = session_with_auth.get(f"{BASE_URL}/api/menu")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_menu_item(self, session_with_auth):
        payload = {"name": "TEST_Espresso", "category": "Hot Drinks", "price": 120, "available": True}
        resp = session_with_auth.post(f"{BASE_URL}/api/menu", json=payload)
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert data["name"] == "TEST_Espresso"
        assert data["price"] == 120
        return data.get("id") or data.get("_id")


class TestWalkIns:
    """Walk-ins tests"""

    def test_get_walkins(self, session_with_auth):
        resp = session_with_auth.get(f"{BASE_URL}/api/walkins")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_walkin(self, session_with_auth):
        import datetime
        payload = {"customer_name": "TEST_Customer", "party_size": 2, "date": datetime.date.today().isoformat()}
        resp = session_with_auth.post(f"{BASE_URL}/api/walkins", json=payload)
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert data.get("customer_name") == "TEST_Customer" or data.get("id")


class TestFloat:
    """Float management tests"""

    def test_get_float_today(self, session_with_auth):
        resp = session_with_auth.get(f"{BASE_URL}/api/float/today")
        assert resp.status_code == 200
        data = resp.json()
        assert "opening_balance" in data or "balance" in data or "float_amount" in data

    def test_get_float_list(self, session_with_auth):
        resp = session_with_auth.get(f"{BASE_URL}/api/float")
        assert resp.status_code == 200


class TestInventory:
    """Inventory tests"""

    def test_get_inventory(self, session_with_auth):
        resp = session_with_auth.get(f"{BASE_URL}/api/inventory")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_inventory_item(self, session_with_auth):
        payload = {"name": "TEST_Coffee Beans", "quantity": 10, "unit": "kg", "low_stock_threshold": 2}
        resp = session_with_auth.post(f"{BASE_URL}/api/inventory", json=payload)
        assert resp.status_code in [200, 201]


class TestDashboard:
    """Dashboard tests"""

    def test_dashboard_stats(self, session_with_auth):
        resp = session_with_auth.get(f"{BASE_URL}/api/dashboard/stats")
        assert resp.status_code == 200
        data = resp.json()
        # Should have some stats keys
        assert isinstance(data, dict)


class TestBilling:
    """Billing tests"""

    def test_get_bills(self, session_with_auth):
        resp = session_with_auth.get(f"{BASE_URL}/api/bills")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_bill(self, session_with_auth):
        import datetime
        # First get a menu item
        menu_resp = session_with_auth.get(f"{BASE_URL}/api/menu")
        menu_items = menu_resp.json()
        if not menu_items:
            pytest.skip("No menu items available for billing test")
        item = menu_items[0]
        item_id = item.get("id") or str(item.get("_id"))
        payload = {
            "customer_name": "TEST_Bill Customer",
            "items": [{"menu_item_id": item_id, "quantity": 1, "price": item["price"]}],
            "payment_method": "Cash",
            "total_amount": item["price"],
            "date": datetime.date.today().isoformat()
        }
        resp = session_with_auth.post(f"{BASE_URL}/api/bills", json=payload)
        assert resp.status_code in [200, 201]


class TestUsers:
    """Users management tests"""

    def test_get_users(self, session_with_auth):
        resp = session_with_auth.get(f"{BASE_URL}/api/users")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
