"""Delta v7 backend tests - PUT /api/bills/{id} edit + inventory rebalance, float=5300, regressions."""
import os, pytest, requests

def _read_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None


_URL = os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()
assert _URL, "REACT_APP_BACKEND_URL not configured"
BASE = _URL.rstrip("/") + "/api"
OWNER = {"email": "owner@dejabrew.com", "password": "BrewOwner2024"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/auth/login", json=OWNER)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def H(token):
    return {"Authorization": f"Bearer {token}"}


# --------- Float opening = 5300 ----------
def test_float_opening_5300(H):
    r = requests.get(f"{BASE}/float/today", headers=H)
    assert r.status_code == 200
    assert r.json()["opening_balance"] == 5300.0


# --------- PUT /api/bills/{id} edit + inventory rebalance ----------
@pytest.fixture(scope="module")
def menu_item_with_recipe(H):
    # create inventory item
    inv = requests.post(f"{BASE}/inventory", json={
        "name": "TEST_v7_milk", "category": "Dairy", "current_stock": 1000.0,
        "unit": "ml", "min_quantity": 10,
    }, headers=H)
    assert inv.status_code in (200, 201), inv.text
    inv_id = inv.json()["id"]

    # create menu item
    m = requests.post(f"{BASE}/menu", json={
        "name": "TEST_v7_latte", "category": "Coffee", "price": 150.0, "active": True,
    }, headers=H)
    assert m.status_code in (200, 201), m.text
    mid = m.json()["id"]

    # create recipe: 1 latte = 100ml milk
    rc = requests.post(f"{BASE}/recipes", json={
        "menu_item_id": mid,
        "menu_item_name": "TEST_v7_latte",
        "ingredients": [{"inventory_item_id": inv_id, "item_name": "TEST_v7_milk", "quantity": 100.0, "unit": "ml"}],
    }, headers=H)
    assert rc.status_code in (200, 201), rc.text
    yield {"menu_id": mid, "inv_id": inv_id}

    # teardown
    requests.delete(f"{BASE}/menu/{mid}", headers=H)
    requests.delete(f"{BASE}/inventory/{inv_id}", headers=H)


def _stock(H, inv_id):
    r = requests.get(f"{BASE}/inventory", headers=H)
    for it in r.json():
        if it["id"] == inv_id:
            return it["current_stock"]
    return None


def test_edit_bill_rebalances_inventory(H, menu_item_with_recipe):
    mid, inv_id = menu_item_with_recipe["menu_id"], menu_item_with_recipe["inv_id"]
    before = _stock(H, inv_id)

    # create with qty=1 -> deduct 100
    create = requests.post(f"{BASE}/bills", json={
        "customer_name": "TEST_v7_edit_rebalance", "customer_phone": "9999999999",
        "items": [{"menu_item_id": mid, "name": "TEST_v7_latte", "price": 150.0, "quantity": 1, "item_discount_pct": 0}],
        "overall_discount": 0, "payment_mode": "cash",
    }, headers=H)
    assert create.status_code == 200, create.text
    bill = create.json()
    bill_id = bill["id"]
    assert len(bill["inventory_deductions"]) == 1
    assert bill["inventory_deductions"][0]["quantity_deducted"] == 100.0

    after_create = _stock(H, inv_id)
    assert abs((before - after_create) - 100.0) < 0.001, f"expected -100, got {before-after_create}"

    # PUT edit qty to 2 -> net deduction should be 200 from original
    upd1 = requests.put(f"{BASE}/bills/{bill_id}", json={
        "customer_name": "TEST_v7_edit_rebalance_2x", "customer_phone": "9999999999",
        "items": [{"menu_item_id": mid, "name": "TEST_v7_latte", "price": 150.0, "quantity": 2, "item_discount_pct": 0}],
        "overall_discount": 0, "payment_mode": "cash",
    }, headers=H)
    assert upd1.status_code == 200, upd1.text
    u1 = upd1.json()
    # response has recomputed fields
    assert u1["subtotal"] == 300.0
    assert u1["cgst"] == 7.5 and u1["sgst"] == 7.5
    assert u1["total"] == 315.0
    assert u1["customer_name"] == "TEST_v7_edit_rebalance_2x"
    assert "last_edited_at" in u1 and u1["last_edited_at"]
    assert u1["last_edited_by"]

    after_edit_2x = _stock(H, inv_id)
    assert abs((before - after_edit_2x) - 200.0) < 0.001, f"expected -200 net, got {before-after_edit_2x}"

    # PUT edit qty back to 1 -> net deduction back to 100
    upd2 = requests.put(f"{BASE}/bills/{bill_id}", json={
        "customer_name": "TEST_v7_edit_rebalance_1x", "customer_phone": "9999999999",
        "items": [{"menu_item_id": mid, "name": "TEST_v7_latte", "price": 150.0, "quantity": 1, "item_discount_pct": 0}],
        "overall_discount": 0, "payment_mode": "cash",
    }, headers=H)
    assert upd2.status_code == 200, upd2.text
    after_edit_1x = _stock(H, inv_id)
    assert abs((before - after_edit_1x) - 100.0) < 0.001, f"expected -100 back, got {before-after_edit_1x}"

    # GET verifies persistence
    got = requests.get(f"{BASE}/bills/{bill_id}", headers=H)
    assert got.status_code == 200
    g = got.json()
    assert g["items"][0]["quantity"] == 1
    assert g["customer_name"] == "TEST_v7_edit_rebalance_1x"


def test_edit_bill_404_on_unknown(H):
    r = requests.put(f"{BASE}/bills/507f1f77bcf86cd799439011", json={
        "customer_name": "x", "items": [], "overall_discount": 0, "payment_mode": "cash",
    }, headers=H)
    assert r.status_code == 404


# --------- Regression ----------
def test_void_endpoint_removed(H):
    # create a bill and try void - should 404
    c = requests.post(f"{BASE}/bills", json={
        "customer_name": "TEST_v7_voidprobe", "items": [{"menu_item_id": "fake", "name": "X", "price": 10, "quantity": 1}],
        "overall_discount": 0, "payment_mode": "cash",
    }, headers=H)
    assert c.status_code == 200
    bid = c.json()["id"]
    v = requests.post(f"{BASE}/bills/{bid}/void", headers=H)
    assert v.status_code == 404


def test_walkin_still_works(H):
    r = requests.post(f"{BASE}/walkins", json={"num_guests": 2, "payment_mode": "cash"}, headers=H)
    assert r.status_code in (200, 201), r.text


def test_inventory_without_cost_per_unit(H):
    r = requests.post(f"{BASE}/inventory", json={
        "name": "TEST_v7_nopct", "category": "Other", "current_stock": 5, "unit": "pc", "min_quantity": 1,
    }, headers=H)
    assert r.status_code in (200, 201), r.text
    iid = r.json()["id"]
    requests.delete(f"{BASE}/inventory/{iid}", headers=H)


def test_banking_backdated(H):
    r = requests.post(f"{BASE}/banking", json={
        "amount": 1.0, "depositor_name": "TEST_v7", "notes": "tv7", "date": "2026-01-10",
    }, headers=H)
    assert r.status_code in (200, 201), r.text
    if "id" in r.json():
        requests.delete(f"{BASE}/banking/{r.json()['id']}", headers=H)


def test_misc_payments_crud(H):
    r = requests.post(f"{BASE}/misc-payments", json={
        "amount": 50, "source": "TEST_v7", "category": "other", "payment_mode": "cash",
    }, headers=H)
    assert r.status_code in (200, 201), r.text
    mid = r.json()["id"]
    d = requests.delete(f"{BASE}/misc-payments/{mid}", headers=H)
    assert d.status_code in (200, 204)
