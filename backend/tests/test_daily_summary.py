"""Daily Summary — category-wise daily sales report endpoint tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://deja-brew-erp.preview.emergentagent.com").rstrip("/")

OWNER = {"email": "owner@dejabrew.com", "password": "BrewOwner2024"}


@pytest.fixture(scope="module")
def owner_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=OWNER, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No token in login response: {data}"
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


class TestDailySummary:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/dashboard/daily-summary", timeout=30)
        assert r.status_code in (401, 403), f"Expected auth error, got {r.status_code}"

    def test_shape(self, owner_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/daily-summary", headers=owner_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        for key in ["date", "generated_at", "bills", "categories", "breakup", "payment_modes", "totals"]:
            assert key in d, f"Missing top-level key '{key}'"
        assert isinstance(d["categories"], list)
        assert isinstance(d["payment_modes"], list)
        for key in ["cash", "upi", "collected", "gross", "total_discount", "net_without_tax",
                    "cgst", "sgst", "tax", "round_off", "net_with_tax"]:
            assert key in d["breakup"], f"Missing breakup key '{key}'"

    def test_specific_date(self, owner_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/daily-summary?date_str=2020-01-01",
                         headers=owner_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["date"] == "2020-01-01"
        assert d["bills"] == 0
        assert d["categories"] == []
        assert d["breakup"]["net_with_tax"] == 0

    def test_breakup_cross_foots(self, owner_headers):
        """net_with_tax must equal net_without_tax + tax + round_off, and collected = cash + upi."""
        r = requests.get(f"{BASE_URL}/api/dashboard/daily-summary", headers=owner_headers, timeout=30)
        b = r.json()["breakup"]
        assert abs(b["net_with_tax"] - (b["net_without_tax"] + b["tax"] + b["round_off"])) < 0.05
        assert abs(b["collected"] - (b["cash"] + b["upi"])) < 0.05

    def test_category_percentages_sum_to_100(self, owner_headers):
        cats = requests.get(f"{BASE_URL}/api/dashboard/daily-summary",
                            headers=owner_headers, timeout=30).json()["categories"]
        if not cats:
            pytest.skip("No sales for today")
        assert abs(sum(c["percent"] for c in cats) - 100.0) <= 0.5
        for c in cats:
            for key in ["category", "items", "total", "qty", "percent"]:
                assert key in c
