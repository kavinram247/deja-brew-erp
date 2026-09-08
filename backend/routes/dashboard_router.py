import asyncio
from fastapi import APIRouter, Request
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import get_db
from auth_utils import get_current_user
from stations import BARISTA, KITCHEN, UNASSIGNED, STATION_LABELS, resolve_station

router = APIRouter()


async def _aggregate_range(db, start: str, end: str) -> list[dict]:
    bills_by_date = {r["_id"]: r for r in await db.bills.aggregate([
        {"$match": {"date": {"$gte": start, "$lte": end}, "is_voided": {"$ne": True}}},
        {"$group": {
            "_id": "$date",
            "offline_revenue": {"$sum": "$total"},
            "bills": {"$sum": 1},
            "cash": {"$sum": "$cash_amount"},
            "upi": {"$sum": "$upi_amount"},
        }},
    ]).to_list(None)}
    online_by_date = {r["_id"]: r for r in await db.online_sales.aggregate([
        {"$match": {"date": {"$gte": start, "$lte": end}}},
        {"$group": {
            "_id": "$date",
            "online_revenue": {"$sum": "$net_sales"},
            "platforms": {"$push": {"p": "$platform", "v": "$net_sales"}},
        }},
    ]).to_list(None)}
    walkins_by_date = {r["_id"]: r for r in await db.walkins.aggregate([
        {"$match": {"date": {"$gte": start, "$lte": end}}},
        {"$group": {
            "_id": "$date",
            "walkins": {"$sum": 1},
            "guests": {"$sum": {"$ifNull": ["$num_guests", 1]}},
        }},
    ]).to_list(None)}

    rows = []
    cur = datetime.strptime(start, "%Y-%m-%d")
    end_dt = datetime.strptime(end, "%Y-%m-%d")
    while cur <= end_dt:
        d = cur.strftime("%Y-%m-%d")
        b = bills_by_date.get(d, {})
        o = online_by_date.get(d, {})
        w = walkins_by_date.get(d, {})
        platform_map = {}
        for entry in o.get("platforms", []):
            p = entry.get("p", "other")
            platform_map[p] = platform_map.get(p, 0) + entry.get("v", 0)
        offline = b.get("offline_revenue", 0)
        online = o.get("online_revenue", 0)
        rows.append({
            "date": d,
            "offline_revenue": offline,
            "online_revenue": online,
            "total_revenue": offline + online,
            "bills": b.get("bills", 0),
            "walkins": w.get("walkins", 0),
            "guests": w.get("guests", 0),
            "cash": b.get("cash", 0),
            "upi": b.get("upi", 0),
            "platforms": platform_map,
        })
        cur += timedelta(days=1)
    return rows


@router.get("/stats")
async def get_stats(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    walkins = await db.walkins.find({"date": today}).to_list(1000)
    total_walkins = len(walkins)
    total_guests = sum(w.get("num_guests", 1) for w in walkins)

    bills = await db.bills.find({"date": today, "is_voided": {"$ne": True}}).to_list(1000)
    offline_revenue = sum(b.get("total", 0) for b in bills)
    total_bills = len(bills)
    cash_rev = sum(b.get("cash_amount", 0) for b in bills)
    upi_rev = sum(b.get("upi_amount", 0) for b in bills)

    online_raw = await db.online_sales.find({"date": today}).to_list(1000)
    online_revenue = sum(o.get("net_sales", 0) for o in online_raw)
    platform_sales = {}
    for o in online_raw:
        p = o.get("platform", "other")
        platform_sales[p] = platform_sales.get(p, 0) + o.get("net_sales", 0)

    total_revenue = round(offline_revenue + online_revenue, 2)

    float_day = await db.float_days.find_one({"date": today})
    float_balance = float_day["closing_balance"] if float_day else 5200.0
    float_spent = round(5200.0 - float_balance, 2) if float_day else 0.0

    low_stock = await db.inventory.count_documents(
        {"$expr": {"$lte": ["$current_stock", "$min_quantity"]}}
    )

    trend_start = (datetime.now(timezone.utc) - timedelta(days=6)).strftime("%Y-%m-%d")
    trend_end = today

    t_bills = {r["_id"]: r for r in await db.bills.aggregate([
        {"$match": {"date": {"$gte": trend_start, "$lte": trend_end}, "is_voided": {"$ne": True}}},
        {"$group": {"_id": "$date", "revenue": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ]).to_list(None)}
    t_online = {r["_id"]: r for r in await db.online_sales.aggregate([
        {"$match": {"date": {"$gte": trend_start, "$lte": trend_end}}},
        {"$group": {"_id": "$date", "revenue": {"$sum": "$net_sales"}}},
    ]).to_list(None)}
    t_walkins = {r["_id"]: r for r in await db.walkins.aggregate([
        {"$match": {"date": {"$gte": trend_start, "$lte": trend_end}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}, "guests": {"$sum": {"$ifNull": ["$num_guests", 1]}}}},
    ]).to_list(None)}

    trend = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        b = t_bills.get(d, {})
        o = t_online.get(d, {})
        w = t_walkins.get(d, {})
        offline = b.get("revenue", 0)
        online = o.get("revenue", 0)
        trend.append({
            "date": d,
            "offline": offline,
            "online": online,
            "revenue": offline + online,
            "walkins": w.get("count", 0),
            "guests": w.get("guests", 0),
            "bills": b.get("count", 0),
        })

    recent = await db.bills.find({"date": today, "is_voided": {"$ne": True}}).sort("created_at", -1).limit(5).to_list(5)
    for b in recent:
        b["id"] = str(b.pop("_id"))

    month_start = datetime.now(timezone.utc).strftime("%Y-%m-01")
    m_bills_agg, m_online_agg = await asyncio.gather(
        db.bills.aggregate([
            {"$match": {"date": {"$gte": month_start}, "is_voided": {"$ne": True}}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}},
        ]).to_list(1),
        db.online_sales.aggregate([
            {"$match": {"date": {"$gte": month_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$net_sales"}}},
        ]).to_list(1),
    )
    monthly_revenue = (m_bills_agg[0]["total"] if m_bills_agg else 0) + (m_online_agg[0]["total"] if m_online_agg else 0)

    return {
        "date": today,
        "walkins": {"total": total_walkins, "guests": total_guests},
        "bills": {"total": total_bills, "revenue": offline_revenue, "cash": cash_rev, "upi": upi_rev},
        "online": {"revenue": online_revenue, "platforms": platform_sales},
        "total_revenue": total_revenue,
        "float": {"balance": float_balance, "spent": float_spent},
        "low_stock_count": low_stock,
        "trend": trend,
        "recent_bills": recent,
        "monthly_revenue": monthly_revenue,
    }


@router.get("/analytics")
async def get_analytics(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    days: int = 30,
    compare_from: Optional[str] = None,
    compare_to: Optional[str] = None,
):
    db = get_db()
    await get_current_user(request, db)

    end = to_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start = from_date or (datetime.now(timezone.utc) - timedelta(days=days - 1)).strftime("%Y-%m-%d")

    current = await _aggregate_range(db, start, end)
    if compare_from and compare_to:
        comparison = await _aggregate_range(db, compare_from, compare_to)
        return {"current": current, "comparison": comparison}
    return current


@router.get("/top-items")
async def get_top_items(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    db = get_db()
    await get_current_user(request, db)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end = to_date or today
    start = from_date or datetime.now(timezone.utc).strftime("%Y-%m-01")

    pipeline = [
        {"$match": {"date": {"$gte": start, "$lte": end}, "is_voided": {"$ne": True}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.name",
            "quantity_sold": {"$sum": "$items.quantity"},
            "revenue": {"$sum": "$items.subtotal"},
        }},
        {"$sort": {"revenue": -1}},
        {"$project": {
            "_id": 0,
            "name": "$_id",
            "quantity_sold": 1,
            "revenue": {"$round": ["$revenue", 2]},
        }},
    ]
    return await db.bills.aggregate(pipeline).to_list(None)


@router.get("/hourly-breakdown")
async def get_hourly_breakdown(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    db = get_db()
    await get_current_user(request, db)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end = to_date or today
    start = from_date or datetime.now(timezone.utc).strftime("%Y-%m-01")

    pipeline = [
        {"$match": {"date": {"$gte": start, "$lte": end}, "is_voided": {"$ne": True}, "created_at": {"$exists": True}}},
        {"$addFields": {"created_dt": {"$dateFromString": {"dateString": "$created_at", "onError": None, "onNull": None}}}},
        {"$match": {"created_dt": {"$ne": None}}},
        {"$group": {
            "_id": {"$hour": {"date": "$created_dt", "timezone": "Asia/Kolkata"}},
            "bills": {"$sum": 1},
            "revenue": {"$sum": "$total"},
        }},
    ]
    raw = {r["_id"]: r for r in await db.bills.aggregate(pipeline).to_list(None)}

    return [
        {
            "hour": h,
            "bills": raw.get(h, {}).get("bills", 0),
            "revenue": round(raw.get(h, {}).get("revenue", 0), 2),
        }
        for h in range(24)
    ]


@router.get("/tax-summary")
async def get_tax_summary(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    db = get_db()
    await get_current_user(request, db)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end = to_date or today
    start = from_date or datetime.now(timezone.utc).strftime("%Y-%m-01")

    pipeline = [
        {"$match": {"date": {"$gte": start, "$lte": end}, "is_voided": {"$ne": True}}},
        {"$group": {
            "_id": None,
            "total_cgst": {"$sum": "$cgst"},
            "total_sgst": {"$sum": "$sgst"},
            "total_service_charge": {"$sum": "$service_charge"},
            "taxable_amount": {"$sum": "$taxable_amount"},
            "total_bills": {"$sum": 1},
        }},
    ]
    result = await db.bills.aggregate(pipeline).to_list(1)
    if not result:
        return {"total_cgst": 0, "total_sgst": 0, "total_gst": 0, "total_service_charge": 0, "taxable_amount": 0, "total_bills": 0}
    r = result[0]
    r.pop("_id", None)
    for k in ["total_cgst", "total_sgst", "total_service_charge", "taxable_amount"]:
        r[k] = round(r.get(k, 0), 2)
    r["total_gst"] = round(r["total_cgst"] + r["total_sgst"], 2)
    return r


@router.get("/dow-breakdown")
async def get_dow_breakdown(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    db = get_db()
    await get_current_user(request, db)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end = to_date or today
    start = from_date or datetime.now(timezone.utc).strftime("%Y-%m-01")

    bills_pipe = [
        {"$match": {"date": {"$gte": start, "$lte": end}, "is_voided": {"$ne": True}, "created_at": {"$exists": True}}},
        {"$addFields": {"dt": {"$dateFromString": {"dateString": "$created_at", "onError": None, "onNull": None}}}},
        {"$match": {"dt": {"$ne": None}}},
        {"$group": {
            "_id": {"$dayOfWeek": {"date": "$dt", "timezone": "Asia/Kolkata"}},
            "revenue": {"$sum": "$total"},
            "bills": {"$sum": 1},
        }},
    ]
    walkins_pipe = [
        {"$match": {"date": {"$gte": start, "$lte": end}}},
        {"$addFields": {"dt": {"$dateFromString": {"dateString": {"$concat": ["$date", "T12:00:00+05:30"]}}}}},
        {"$group": {
            "_id": {"$dayOfWeek": {"date": "$dt", "timezone": "Asia/Kolkata"}},
            "walkins": {"$sum": 1},
        }},
    ]
    bills_res, walkins_res = await asyncio.gather(
        db.bills.aggregate(bills_pipe).to_list(None),
        db.walkins.aggregate(walkins_pipe).to_list(None),
    )

    # MongoDB $dayOfWeek: 1=Sun, 2=Mon, ..., 7=Sat → remap to 0=Mon...6=Sun
    LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    b_map = {r["_id"]: r for r in bills_res}
    w_map = {r["_id"]: r for r in walkins_res}

    result = []
    for dow_0 in range(7):  # 0=Mon ... 6=Sun
        mongo_dow = (dow_0 + 2) if dow_0 < 6 else 1  # Mon→2, Tue→3, ..., Sat→7, Sun→1
        b = b_map.get(mongo_dow, {})
        w = w_map.get(mongo_dow, {})
        result.append({
            "dow": dow_0,
            "label": LABELS[dow_0],
            "revenue": round(b.get("revenue", 0), 2),
            "bills": b.get("bills", 0),
            "walkins": w.get("walkins", 0),
        })
    return result


@router.get("/discount-stats")
async def get_discount_stats(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    db = get_db()
    await get_current_user(request, db)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end = to_date or today
    start = from_date or datetime.now(timezone.utc).strftime("%Y-%m-01")

    pipeline = [
        {"$match": {"date": {"$gte": start, "$lte": end}, "is_voided": {"$ne": True}}},
        {"$group": {
            "_id": None,
            "total_bills": {"$sum": 1},
            "total_overall_discount": {"$sum": "$overall_discount"},
            "total_service_charge": {"$sum": "$service_charge"},
            "service_charge_count": {"$sum": {"$cond": [{"$eq": ["$service_charge_enabled", True]}, 1, 0]}},
            "gross_subtotal": {"$sum": "$subtotal"},
        }},
    ]
    result = await db.bills.aggregate(pipeline).to_list(1)
    if not result:
        return {"total_bills": 0, "total_overall_discount": 0, "total_service_charge": 0, "service_charge_count": 0, "gross_subtotal": 0}
    r = result[0]
    r.pop("_id", None)
    for k in ["total_overall_discount", "total_service_charge", "gross_subtotal"]:
        r[k] = round(r.get(k, 0), 2)
    return r


# Human-friendly labels for the payment-mode breakdown
_PAY_MODE_LABELS = {"cash": "Cash", "upi": "UPI", "cash+upi": "Split (Cash+UPI)", "card": "Card"}


def _compute_daily_summary(day: str, bills: list, menu_items: list, generated_at: str) -> dict:
    """Pure aggregation for the daily summary — no DB access, so it is unit-testable.

    bills: raw bill docs for the day (already filtered to non-voided).
    menu_items: raw menu docs (need _id, name, category) for the category join.
    """
    # Bill items don't store a category — join menu_item_id (fallback: name) -> category.
    cat_by_id = {str(m["_id"]): (m.get("category") or "Uncategorized") for m in menu_items}
    cat_by_name = {}
    for m in menu_items:
        nm = (m.get("name") or "").strip().lower()
        if nm:
            cat_by_name.setdefault(nm, m.get("category") or "Uncategorized")

    categories: dict = {}
    breakup = {
        "cash": 0.0, "upi": 0.0, "gross": 0.0, "item_discount": 0.0,
        "overall_discount": 0.0, "cgst": 0.0, "sgst": 0.0,
        "service_charge": 0.0, "round_off": 0.0, "net_with_tax": 0.0,
    }
    pay_modes: dict = {}
    total_qty = 0

    for b in bills:
        for it in b.get("items", []):
            name = (it.get("name") or "").strip() or "Unnamed"
            category = (
                cat_by_id.get(it.get("menu_item_id"))
                or cat_by_name.get(name.lower())
                or "Uncategorized"
            )
            qty = it.get("quantity", 0) or 0
            amount = round(it.get("subtotal", 0) or 0, 2)
            gross = it.get("gross")
            if gross is None:
                gross = (it.get("price", 0) or 0) * qty
            gross = round(gross, 2)

            cat = categories.setdefault(category, {"category": category, "items": {}, "total": 0.0, "qty": 0})
            row = cat["items"].setdefault(name, {"name": name, "count": 0, "amount": 0.0})
            row["count"] += qty
            row["amount"] = round(row["amount"] + amount, 2)
            cat["total"] = round(cat["total"] + amount, 2)
            cat["qty"] += qty

            breakup["gross"] = round(breakup["gross"] + gross, 2)
            breakup["item_discount"] = round(breakup["item_discount"] + (it.get("item_discount", 0) or 0), 2)
            total_qty += qty

        breakup["cash"] = round(breakup["cash"] + (b.get("cash_amount", 0) or 0), 2)
        breakup["upi"] = round(breakup["upi"] + (b.get("upi_amount", 0) or 0), 2)
        breakup["overall_discount"] = round(breakup["overall_discount"] + (b.get("overall_discount", 0) or 0), 2)
        breakup["cgst"] = round(breakup["cgst"] + (b.get("cgst", 0) or 0), 2)
        breakup["sgst"] = round(breakup["sgst"] + (b.get("sgst", 0) or 0), 2)
        breakup["service_charge"] = round(breakup["service_charge"] + (b.get("service_charge", 0) or 0), 2)
        breakup["round_off"] = round(breakup["round_off"] + (b.get("round_off", 0) or 0), 2)
        breakup["net_with_tax"] = round(breakup["net_with_tax"] + (b.get("total", 0) or 0), 2)

        mode = (b.get("payment_mode") or "unknown").lower()
        pm = pay_modes.setdefault(mode, {"mode": mode, "bills": 0, "amount": 0.0})
        pm["bills"] += 1
        pm["amount"] = round(pm["amount"] + (b.get("total", 0) or 0), 2)

    item_sales = round(sum(c["total"] for c in categories.values()), 2)

    cat_list = []
    for c in categories.values():
        items = sorted(c["items"].values(), key=lambda x: x["amount"], reverse=True)
        cat_list.append({
            "category": c["category"],
            "items": items,
            "total": c["total"],
            "qty": c["qty"],
            "percent": round(c["total"] / item_sales * 100, 2) if item_sales else 0.0,
        })
    cat_list.sort(key=lambda x: x["total"], reverse=True)

    pm_list = sorted(pay_modes.values(), key=lambda x: x["amount"], reverse=True)
    for pm in pm_list:
        pm["label"] = _PAY_MODE_LABELS.get(pm["mode"], pm["mode"].title())

    total_discount = round(breakup["item_discount"] + breakup["overall_discount"], 2)
    tax = round(breakup["cgst"] + breakup["sgst"] + breakup["service_charge"], 2)
    net_without_tax = round(breakup["gross"] - total_discount, 2)
    collected = round(breakup["cash"] + breakup["upi"], 2)

    return {
        "date": day,
        "generated_at": generated_at,
        "bills": len(bills),
        "categories": cat_list,
        "breakup": {
            "cash": breakup["cash"],
            "upi": breakup["upi"],
            "card": 0.0,
            "collected": collected,
            "gross": breakup["gross"],
            "item_discount": breakup["item_discount"],
            "overall_discount": breakup["overall_discount"],
            "total_discount": total_discount,
            "complementary": 0.0,
            "net_without_tax": net_without_tax,
            "cgst": breakup["cgst"],
            "sgst": breakup["sgst"],
            "service_charge": breakup["service_charge"],
            "tax": tax,
            "round_off": breakup["round_off"],
            "net_with_tax": breakup["net_with_tax"],
        },
        "payment_modes": pm_list,
        "totals": {"bills": len(bills), "qty": total_qty, "item_sales": item_sales},
    }


@router.get("/daily-summary")
async def get_daily_summary(request: Request, date_str: Optional[str] = None):
    """Category-wise daily sales summary for a single day (POS bills only).

    Mirrors the café's end-of-day "Category Wise Report": each menu category with
    its items (qty + amount) and share of sales, plus a sales/tax/payment breakup.
    """
    db = get_db()
    await get_current_user(request, db)
    day = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    bills = await db.bills.find({"date": day, "is_voided": {"$ne": True}}).to_list(None)
    menu_items = await db.menu_items.find({}, {"category": 1, "name": 1}).to_list(None)

    return _compute_daily_summary(day, bills, menu_items, datetime.now(timezone.utc).isoformat())


def _compute_station_sales(start: str, end: str, bills: list, menu_items: list) -> dict:
    """Split item sales across barista / kitchen. Pure — no DB access, unit-testable.

    Station is resolved at report time (bill items don't store it), so historical
    bills are included and reflect the item's current station assignment.
    """
    by_id = {str(m["_id"]): resolve_station(m) for m in menu_items}
    by_name = {}
    for m in menu_items:
        nm = (m.get("name") or "").strip().lower()
        if nm:
            by_name.setdefault(nm, resolve_station(m))

    keys = (BARISTA, KITCHEN, UNASSIGNED)
    agg = {k: {"revenue": 0.0, "qty": 0, "bills": 0} for k in keys}
    items = {k: {} for k in keys}
    daily = {}

    for b in bills:
        day = b.get("date")
        seen = set()
        for it in b.get("items", []):
            name = (it.get("name") or "").strip() or "Unnamed"
            st = by_id.get(it.get("menu_item_id")) or by_name.get(name.lower()) or UNASSIGNED
            if st not in agg:
                st = UNASSIGNED
            qty = it.get("quantity", 0) or 0
            amount = round(it.get("subtotal", 0) or 0, 2)

            agg[st]["revenue"] = round(agg[st]["revenue"] + amount, 2)
            agg[st]["qty"] += qty
            seen.add(st)

            row = items[st].setdefault(name, {"name": name, "qty": 0, "revenue": 0.0})
            row["qty"] += qty
            row["revenue"] = round(row["revenue"] + amount, 2)

            if day:
                d = daily.setdefault(day, {k: 0.0 for k in keys})
                d[st] = round(d[st] + amount, 2)

        for st in seen:
            agg[st]["bills"] += 1

    total_rev = round(sum(agg[k]["revenue"] for k in keys), 2)
    total_qty = sum(agg[k]["qty"] for k in keys)

    stations = []
    for k in keys:
        a = agg[k]
        # Only surface the catch-all bucket when something actually landed in it
        if k == UNASSIGNED and a["revenue"] == 0 and a["qty"] == 0:
            continue
        stations.append({
            "station": k,
            "label": STATION_LABELS[k],
            "revenue": a["revenue"],
            "qty": a["qty"],
            "bills": a["bills"],
            "share": round(a["revenue"] / total_rev * 100, 2) if total_rev else 0.0,
            "top_items": sorted(items[k].values(), key=lambda x: x["revenue"], reverse=True)[:5],
        })

    # Continuous daily series so charts don't gap
    rows = []
    try:
        cur = datetime.strptime(start, "%Y-%m-%d")
        end_dt = datetime.strptime(end, "%Y-%m-%d")
    except (TypeError, ValueError):
        cur = end_dt = None
    while cur is not None and cur <= end_dt:
        d = cur.strftime("%Y-%m-%d")
        v = daily.get(d, {})
        rows.append({
            "date": d,
            "barista": round(v.get(BARISTA, 0.0), 2),
            "kitchen": round(v.get(KITCHEN, 0.0), 2),
            "unassigned": round(v.get(UNASSIGNED, 0.0), 2),
        })
        cur += timedelta(days=1)

    return {
        "from": start,
        "to": end,
        "stations": stations,
        "totals": {"revenue": total_rev, "qty": total_qty},
        "daily": rows,
    }


@router.get("/station-sales")
async def get_station_sales(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    """Barista vs kitchen sales split for a date range (POS bills only)."""
    db = get_db()
    await get_current_user(request, db)

    end = to_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start = from_date or datetime.now(timezone.utc).strftime("%Y-%m-01")

    bills, menu_items = await asyncio.gather(
        db.bills.find({"date": {"$gte": start, "$lte": end}, "is_voided": {"$ne": True}}).to_list(None),
        db.menu_items.find({}, {"category": 1, "name": 1, "station": 1}).to_list(None),
    )
    return _compute_station_sales(start, end, bills, menu_items)
