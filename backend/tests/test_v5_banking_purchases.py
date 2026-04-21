"""Delta v5 tests: employee banking CRUD + float expense breakdown data."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def owner_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "owner@dejabrew.com", "password": "BrewOwner2024"})
    assert r.status_code == 200, f"owner login failed: {r.text}"
    return s


@pytest.fixture(scope="module")
def employee_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "employee@dejabrew.com", "password": "Emp12345"})
    assert r.status_code == 200, f"employee login failed: {r.text}"
    return s


# --- Banking: employee access (previously owner-only, now any auth user) ---
class TestEmployeeBanking:
    created_ids = []

    def test_employee_can_post_banking(self, employee_session):
        payload = {"amount": 2500.0, "depositor_name": "TEST_Ravi", "notes": "TEST emp handover"}
        r = employee_session.post(f"{BASE_URL}/api/banking", json=payload)
        assert r.status_code == 200, f"POST failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["depositor_name"] == "TEST_Ravi"
        assert data["amount"] == 2500.0
        assert "id" in data
        assert data.get("created_by_name") == "Test Employee", f"created_by_name missing: {data}"
        TestEmployeeBanking.created_ids.append(data["id"])

    def test_employee_can_get_banking(self, employee_session):
        r = employee_session.get(f"{BASE_URL}/api/banking")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Our created entry should be present
        ids = [e["id"] for e in data]
        assert TestEmployeeBanking.created_ids[0] in ids

    def test_employee_can_get_all_banking(self, employee_session):
        r = employee_session.get(f"{BASE_URL}/api/banking/all")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_owner_can_also_get_banking(self, owner_session):
        r = owner_session.get(f"{BASE_URL}/api/banking/all")
        assert r.status_code == 200

    def test_employee_can_delete_banking(self, employee_session):
        # Create then delete
        r = employee_session.post(f"{BASE_URL}/api/banking",
                                  json={"amount": 100.0, "depositor_name": "TEST_DeleteMe"})
        assert r.status_code == 200
        entry_id = r.json()["id"]
        dr = employee_session.delete(f"{BASE_URL}/api/banking/{entry_id}")
        assert dr.status_code == 200
        # Verify removed
        r2 = employee_session.get(f"{BASE_URL}/api/banking")
        ids = [e["id"] for e in r2.json()]
        assert entry_id not in ids

    def test_unauthenticated_blocked(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/banking",
                   json={"amount": 1, "depositor_name": "X"})
        assert r.status_code in (401, 403)

    def test_cleanup(self, employee_session):
        for eid in TestEmployeeBanking.created_ids:
            employee_session.delete(f"{BASE_URL}/api/banking/{eid}")


# --- Float: seed expense data across today so /dashboard/purchases table renders ---
class TestSeedFloatExpenses:
    def test_get_history(self, owner_session):
        r = owner_session.get(f"{BASE_URL}/api/float/history")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_seed_multi_category_expenses_today(self, employee_session, owner_session):
        samples = [
            {"description": "TEST Milk crate", "category": "Raw Materials", "amount": 450.0},
            {"description": "TEST Straws pack", "category": "Consumables", "amount": 180.0},
            {"description": "TEST Electricity bill", "category": "Utilities", "amount": 1200.0},
            {"description": "TEST Coffee beans", "category": "Raw Materials", "amount": 800.0},
        ]
        created = 0
        for s in samples:
            r = employee_session.post(f"{BASE_URL}/api/float/expenses", json=s)
            if r.status_code == 200:
                created += 1
        assert created == 4, f"seeded {created}/4"
        # Owner-only history reflects the new expenses
        r = owner_session.get(f"{BASE_URL}/api/float/history")
        assert r.status_code == 200
        days = r.json()
        assert len(days) > 0
        today_doc = days[0]
        cats = {e["category"] for e in today_doc.get("expenses", [])}
        assert {"Raw Materials", "Consumables", "Utilities"}.issubset(cats), f"cats={cats}"
        print(f"Seeded {created}/4 expenses; history has {len(days)} days; today cats={cats}")
