import asyncio
from fastapi import APIRouter, Request
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import get_db
from auth_utils import get_current_user

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
    m_bills = await db.bills.find(
        {"date": {"$gte": month_start}, "is_voided": {"$ne": True}}
    ).to_list(5000)
    m_online = await db.online_sales.find({"date": {"$gte": month_start}}).to_list(5000)
    monthly_revenue = sum(b.get("total", 0) for b in m_bills) + sum(o.get("net_sales", 0) for o in m_online)

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


@router.get("/void-stats")
async def get_void_stats(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    db = get_db()
    await get_current_user(request, db)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end = to_date or today
    start = from_date or datetime.now(timezone.utc).strftime("%Y-%m-01")

    summary_pipe = [
        {"$match": {"date": {"$gte": start, "$lte": end}}},
        {"$group": {
            "_id": None,
            "total_bills": {"$sum": 1},
            "voided_bills": {"$sum": {"$cond": [{"$eq": ["$is_voided", True]}, 1, 0]}},
            "voided_revenue": {"$sum": {"$cond": [{"$eq": ["$is_voided", True]}, "$total", 0]}},
        }},
    ]
    daily_pipe = [
        {"$match": {"date": {"$gte": start, "$lte": end}}},
        {"$group": {
            "_id": "$date",
            "total": {"$sum": 1},
            "voided": {"$sum": {"$cond": [{"$eq": ["$is_voided", True]}, 1, 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    summary_res, daily_res = await asyncio.gather(
        db.bills.aggregate(summary_pipe).to_list(1),
        db.bills.aggregate(daily_pipe).to_list(None),
    )

    if not summary_res:
        return {"total_bills": 0, "voided_bills": 0, "voided_revenue": 0, "void_rate_pct": 0, "daily": []}
    s = summary_res[0]
    s.pop("_id", None)
    s["voided_revenue"] = round(s.get("voided_revenue", 0), 2)
    s["void_rate_pct"] = round(s["voided_bills"] / s["total_bills"] * 100, 2) if s["total_bills"] else 0
    s["daily"] = [{"date": r["_id"], "total": r["total"], "voided": r["voided"]} for r in daily_res]
    return s


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
