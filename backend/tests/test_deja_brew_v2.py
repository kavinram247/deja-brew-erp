"""
Deja Brew ERP V2 - Full E2E Backend API Tests
Covers: auth, RBAC, inventory, menu, recipes, billing + deduction, void + restore,
routines + deduction, walkins, online sales, float, banking, users, dashboard.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "owner@dejabrew.com"
OWNER_PASSWORD = "BrewOwner2024"

EMP_EMAIL = "employee@dejabrew.com"
EMP_PASSWORD = "Emp12345"


# ---- Fixtures ----
@pytest.fixture(scope="session")
def owner_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, f"Owner login failed: {r.text}"
    return s


@pytest.fixture(scope="session")
def employee_session(owner_session):
    # Ensure employee exists. Registration is idempotent via 400 when exists
    owner_session.post(
        f"{API}/auth/register",
        json={"email": EMP_EMAIL, "password": EMP_PASSWORD, "name": "Test Employee", "role": "employee"},
    )
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": EMP_EMAIL, "password": EMP_PASSWORD})
    assert r.status_code == 200, f"Employee login failed: {r.text}"
    return s


# ---- Auth ----
class TestAuth:
    def test_login_owner(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == OWNER_EMAIL
        assert d["role"] == "owner"
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_returns_user(self, owner_session):
        r = owner_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "owner"

    def test_employee_cannot_register(self, employee_session):
        r = employee_session.post(
            f"{API}/auth/register",
            json={"email": f"x{uuid.uuid4().hex[:6]}@t.com", "password": "pass1234", "name": "X", "role": "employee"},
        )
        assert r.status_code == 403

    def test_logout(self, owner_session):
        # use a fresh session to not break the shared one
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200


# ---- Users ----
class TestUsers:
    def test_owner_lists_users(self, owner_session):
        r = owner_session.get(f"{API}/users")
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        for u in users:
            assert "password_hash" not in u
            assert "id" in u

    def test_employee_cannot_list_users(self, employee_session):
        r = employee_session.get(f"{API}/users")
        assert r.status_code == 403


# ---- Inventory ----
@pytest.fixture(scope="session")
def sample_inventory(owner_session):
    payload = {
        "name": f"TEST_Beans_{uuid.uuid4().hex[:6]}",
        "category": "Coffee",
        "section": "Barista",
        "current_stock": 100.0,
        "unit": "g",
        "min_quantity": 10.0,
        "cost_per_unit": 2.5,
    }
    r = owner_session.post(f"{API}/inventory", json=payload)
    assert r.status_code in (200, 201), r.text
    return r.json()


class TestInventory:
    def test_list(self, owner_session):
        r = owner_session.get(f"{API}/inventory")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_and_persist(self, owner_session, sample_inventory):
        iid = sample_inventory["id"]
        r = owner_session.get(f"{API}/inventory")
        ids = [i["id"] for i in r.json()]
        assert iid in ids
        item = next(i for i in r.json() if i["id"] == iid)
        assert item["current_stock"] == 100.0
        assert item["section"] == "Barista"

    def test_section_filter(self, owner_session, sample_inventory):
        r = owner_session.get(f"{API}/inventory", params={"section": "Barista"})
        assert r.status_code == 200
        for it in r.json():
            assert it["section"] == "Barista"

    def test_adjust_add(self, owner_session, sample_inventory):
        iid = sample_inventory["id"]
        r = owner_session.post(f"{API}/inventory/{iid}/adjust", json={"adjustment": 5.0})
        assert r.status_code == 200
        # Verify persisted
        items = owner_session.get(f"{API}/inventory").json()
        item = next(i for i in items if i["id"] == iid)
        assert item["current_stock"] == 105.0

    def test_adjust_reduce(self, owner_session, sample_inventory):
        iid = sample_inventory["id"]
        r = owner_session.post(f"{API}/inventory/{iid}/adjust", json={"adjustment": -5.0})
        assert r.status_code == 200
        items = owner_session.get(f"{API}/inventory").json()
        item = next(i for i in items if i["id"] == iid)
        assert item["current_stock"] == 100.0

    def test_set_stock(self, owner_session, sample_inventory):
        iid = sample_inventory["id"]
        r = owner_session.post(f"{API}/inventory/{iid}/set-stock", json={"adjustment": 200.0})
        assert r.status_code == 200
        items = owner_session.get(f"{API}/inventory").json()
        item = next(i for i in items if i["id"] == iid)
        assert item["current_stock"] == 200.0


# ---- Menu + Recipe + Bill deduction ----
@pytest.fixture(scope="session")
def sample_menu_item(owner_session):
    r = owner_session.post(
        f"{API}/menu",
        json={"name": f"TEST_Latte_{uuid.uuid4().hex[:6]}", "category": "Coffee", "price": 150.0, "active": True},
    )
    assert r.status_code in (200, 201)
    return r.json()


class TestMenu:
    def test_list_menu(self, owner_session):
        r = owner_session.get(f"{API}/menu")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_employee_cannot_create_menu(self, employee_session):
        r = employee_session.post(
            f"{API}/menu",
            json={"name": "TEST_Forbidden", "category": "X", "price": 10, "active": True},
        )
        assert r.status_code == 403

    def test_owner_creates_menu(self, sample_menu_item):
        assert sample_menu_item["name"].startswith("TEST_Latte_")


class TestRecipe:
    def test_upsert_recipe(self, owner_session, sample_menu_item, sample_inventory):
        payload = {
            "menu_item_id": sample_menu_item["id"],
            "menu_item_name": sample_menu_item["name"],
            "ingredients": [
                {
                    "inventory_item_id": sample_inventory["id"],
                    "item_name": sample_inventory["name"],
                    "quantity": 10.0,
                    "unit": "g",
                }
            ],
        }
        r = owner_session.post(f"{API}/recipes", json=payload)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d["menu_item_id"] == sample_menu_item["id"]
        assert len(d["ingredients"]) == 1

        # Fetch
        r2 = owner_session.get(f"{API}/recipes/{sample_menu_item['id']}")
        assert r2.status_code == 200
        assert r2.json()["ingredients"][0]["quantity"] == 10.0


class TestBillingAndDeduction:
    def test_create_bill_deducts_inventory(self, owner_session, sample_menu_item, sample_inventory):
        # Get pre stock
        pre = next(
            i for i in owner_session.get(f"{API}/inventory").json() if i["id"] == sample_inventory["id"]
        )
        pre_stock = pre["current_stock"]

        payload = {
            "customer_name": "TEST_Walk",
            "items": [
                {
                    "menu_item_id": sample_menu_item["id"],
                    "name": sample_menu_item["name"],
                    "price": 150.0,
                    "quantity": 2,
                    "item_discount_pct": 0.0,
                }
            ],
            "overall_discount": 0.0,
            "payment_mode": "cash",
        }
        r = owner_session.post(f"{API}/bills", json=payload)
        assert r.status_code in (200, 201), r.text
        bill = r.json()
        # Tax math: subtotal=300, cgst=7.5, sgst=7.5, total=315
        assert bill["subtotal"] == 300.0
        assert bill["cgst"] == 7.5
        assert bill["sgst"] == 7.5
        assert bill["total"] == 315.0
        assert bill["cash_amount"] == 315.0
        assert bill["upi_amount"] == 0.0
        assert bill["is_voided"] is False
        assert len(bill["inventory_deductions"]) == 1
        assert bill["inventory_deductions"][0]["quantity_deducted"] == 20.0

        # Verify stock reduced by 10 * 2 = 20
        post = next(
            i for i in owner_session.get(f"{API}/inventory").json() if i["id"] == sample_inventory["id"]
        )
        assert post["current_stock"] == pre_stock - 20.0

        pytest.bill_id = bill["id"]
        pytest.pre_void_stock = post["current_stock"]

    def test_void_restores_inventory_owner(self, owner_session, sample_inventory):
        bill_id = pytest.bill_id
        r = owner_session.post(f"{API}/bills/{bill_id}/void", json={})
        assert r.status_code == 200
        assert r.json()["is_voided"] is True

        # Stock restored
        post = next(
            i for i in owner_session.get(f"{API}/inventory").json() if i["id"] == sample_inventory["id"]
        )
        assert post["current_stock"] == pytest.pre_void_stock + 20.0

    def test_void_already_voided_returns_400(self, owner_session):
        r = owner_session.post(f"{API}/bills/{pytest.bill_id}/void", json={})
        assert r.status_code == 400

    def test_employee_cannot_void(self, employee_session, owner_session, sample_menu_item):
        # Create new bill then try void as employee
        r = owner_session.post(
            f"{API}/bills",
            json={
                "customer_name": "TEST2",
                "items": [
                    {
                        "menu_item_id": sample_menu_item["id"],
                        "name": sample_menu_item["name"],
                        "price": 100.0,
                        "quantity": 1,
                    }
                ],
                "payment_mode": "cash",
            },
        )
        bid = r.json()["id"]
        r2 = employee_session.post(f"{API}/bills/{bid}/void", json={})
        assert r2.status_code == 403

    def test_cash_upi_split(self, owner_session, sample_menu_item):
        payload = {
            "customer_name": "TEST_split",
            "items": [
                {"menu_item_id": sample_menu_item["id"], "name": sample_menu_item["name"], "price": 100.0, "quantity": 1}
            ],
            "payment_mode": "split",
            "cash_amount": 50.0,
            "upi_amount": 55.0,
        }
        r = owner_session.post(f"{API}/bills", json=payload)
        assert r.status_code in (200, 201)
        d = r.json()
        assert d["cash_amount"] == 50.0
        assert d["upi_amount"] == 55.0

    def test_list_bills(self, owner_session):
        r = owner_session.get(f"{API}/bills")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---- Routines ----
class TestRoutines:
    def test_create_execute_deducts(self, owner_session, sample_inventory):
        payload = {
            "name": f"TEST_MachineTest_{uuid.uuid4().hex[:4]}",
            "description": "Test routine",
            "ingredients": [
                {
                    "inventory_item_id": sample_inventory["id"],
                    "item_name": sample_inventory["name"],
                    "quantity": 3.0,
                    "unit": "g",
                }
            ],
        }
        r = owner_session.post(f"{API}/routines", json=payload)
        assert r.status_code in (200, 201)
        rid = r.json()["id"]

        pre = next(i for i in owner_session.get(f"{API}/inventory").json() if i["id"] == sample_inventory["id"])
        r2 = owner_session.post(f"{API}/routines/{rid}/execute", json={"notes": "Test run"})
        assert r2.status_code == 200
        assert len(r2.json()["deductions"]) == 1
        post = next(i for i in owner_session.get(f"{API}/inventory").json() if i["id"] == sample_inventory["id"])
        assert post["current_stock"] == pre["current_stock"] - 3.0

    def test_executions_list(self, owner_session):
        r = owner_session.get(f"{API}/routines/executions")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---- Walk-ins ----
class TestWalkIns:
    def test_crud(self, owner_session):
        r = owner_session.post(f"{API}/walkins", json={"num_guests": 3, "payment_mode": "cash", "notes": "TEST"})
        assert r.status_code in (200, 201)
        wid = r.json()["id"]
        assert r.json()["num_guests"] == 3
        lst = owner_session.get(f"{API}/walkins").json()
        assert any(w["id"] == wid for w in lst)
        d = owner_session.delete(f"{API}/walkins/{wid}")
        assert d.status_code == 200


# ---- Online Sales ----
class TestOnlineSales:
    def test_platform_crud(self, owner_session):
        r = owner_session.post(
            f"{API}/online-sales",
            json={"platform": "swiggy", "gross_sales": 500, "net_sales": 400, "upi_amount": 400, "notes": "TEST"},
        )
        assert r.status_code in (200, 201)
        sid = r.json()["id"]
        assert r.json()["platform"] == "swiggy"
        d = owner_session.delete(f"{API}/online-sales/{sid}")
        assert d.status_code == 200


# ---- Float / Purchases ----
class TestFloat:
    def test_today_seed_opening_5200(self, owner_session):
        r = owner_session.get(f"{API}/float/today")
        assert r.status_code == 200
        d = r.json()
        assert d["opening_balance"] == 5200.0

    def test_add_and_delete_expense(self, owner_session):
        r = owner_session.post(
            f"{API}/float/expenses",
            json={"description": "TEST_milk", "amount": 50.0, "category": "dairy"},
        )
        assert r.status_code == 200
        d = r.json()
        exp_id = d["expenses"][-1]["id"]
        assert d["closing_balance"] < 5200.0
        r2 = owner_session.delete(f"{API}/float/expenses/{exp_id}")
        assert r2.status_code == 200

    def test_history_owner_only(self, owner_session, employee_session):
        r = owner_session.get(f"{API}/float/history")
        assert r.status_code == 200
        r2 = employee_session.get(f"{API}/float/history")
        assert r2.status_code == 403


# ---- Banking (owner only) ----
class TestBanking:
    def test_employee_forbidden(self, employee_session):
        r = employee_session.get(f"{API}/banking")
        assert r.status_code == 403

    def test_owner_crud(self, owner_session):
        r = owner_session.post(
            f"{API}/banking",
            json={"amount": 1000.0, "depositor_name": "TEST_Owner", "notes": "TEST handover"},
        )
        assert r.status_code in (200, 201)
        bid = r.json()["id"]
        lst = owner_session.get(f"{API}/banking").json()
        assert any(x["id"] == bid for x in lst)
        assert owner_session.delete(f"{API}/banking/{bid}").status_code == 200


# ---- Dashboard ----
class TestDashboard:
    def test_stats(self, owner_session):
        r = owner_session.get(f"{API}/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        assert "total_revenue" in d
        assert "trend" in d and len(d["trend"]) == 7
        assert "float" in d and d["float"]["balance"] is not None

    def test_analytics_custom_range(self, owner_session):
        from datetime import datetime, timezone, timedelta
        end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        start = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%d")
        r = owner_session.get(f"{API}/dashboard/analytics", params={"from_date": start, "to_date": end})
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) == 4  # inclusive
        for row in rows:
            assert "date" in row
            assert "total_revenue" in row
