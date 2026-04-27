"""Delta v11 — customers aggregation endpoint tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://deja-brew-erp.preview.emergentagent.com").rstrip("/")

OWNER = {"email": "owner@dejabrew.com", "password": "BrewOwner2024"}


@pytest.fixture(scope="module")
def owner_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}


class TestCustomersEndpoint:
    def test_get_customers_status(self, owner_headers):
        r = requests.get(f"{BASE_URL}/api/customers", headers=owner_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_customer_shape(self, owner_headers):
        r = requests.get(f"{BASE_URL}/api/customers", headers=owner_headers, timeout=30)
        data = r.json()
        if len(data) == 0:
            pytest.skip("No customers seeded")
        c = data[0]
        for key in ["name", "phone", "first_visit", "last_visit", "visit_count", "is_repeat", "total_spent"]:
            assert key in c, f"Missing key '{key}' in {c}"
        assert isinstance(c["visit_count"], int)
        assert isinstance(c["is_repeat"], bool)
        assert isinstance(c["total_spent"], (int, float))

    def test_is_repeat_consistency(self, owner_headers):
        r = requests.get(f"{BASE_URL}/api/customers", headers=owner_headers, timeout=30)
        data = r.json()
        for c in data:
            assert c["is_repeat"] == (c["visit_count"] > 1), f"is_repeat mismatch for {c}"

    def test_sorted_by_last_visit_desc(self, owner_headers):
        r = requests.get(f"{BASE_URL}/api/customers", headers=owner_headers, timeout=30)
        data = r.json()
        last_visits = [c["last_visit"] for c in data]
        assert last_visits == sorted(last_visits, reverse=True), "Not sorted by last_visit desc"

    def test_customers_require_auth(self):
        r = requests.get(f"{BASE_URL}/api/customers", timeout=30)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_repeat_count_bounded(self, owner_headers):
        cust_r = requests.get(f"{BASE_URL}/api/customers", headers=owner_headers, timeout=30)
        customers = cust_r.json()
        repeat = sum(1 for c in customers if c["is_repeat"])
        assert repeat <= len(customers)
        # visit counts must be >=1
        for c in customers:
            assert c["visit_count"] >= 1
