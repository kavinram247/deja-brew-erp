from fastapi import APIRouter, Request
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


@router.get("/stats")
async def get_stats(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Walk-ins
    walkins = await db.walkins.find({"date": today}).to_list(1000)
    total_walkins = len(walkins)
    total_guests = sum(w.get("num_guests", 1) for w in walkins)

    # Bills (offline)
    bills = await db.bills.find({"date": today, "is_voided": {"$ne": True}}).to_list(1000)
    offline_revenue = sum(b.get("total", 0) for b in bills)
    total_bills = len(bills)
    cash_rev = sum(b.get("cash_amount", 0) for b in bills)
    upi_rev = sum(b.get("upi_amount", 0) for b in bills)

    # Online sales
    online_raw = await db.online_sales.find({"date": today}).to_list(1000)
    online_revenue = sum(o.get("net_sales", 0) for o in online_raw)
    platform_sales = {}
    for o in online_raw:
        p = o.get("platform", "other")
        platform_sales[p] = platform_sales.get(p, 0) + o.get("net_sales", 0)

    total_revenue = round(offline_revenue + online_revenue, 2)

    # Float
    float_day = await db.float_days.find_one({"date": today})
    float_balance = float_day["closing_balance"] if float_day else 5200.0
    float_spent = round(5200.0 - float_balance, 2) if float_day else 0.0

    # Low stock
    low_stock = await db.inventory.count_documents(
        {"$expr": {"$lte": ["$current_stock", "$min_quantity"]}}
    )

    # 7-day trend
    trend = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        d_bills = await db.bills.find({"date": d, "is_voided": {"$ne": True}}).to_list(1000)
        d_online = await db.online_sales.find({"date": d}).to_list(1000)
        d_walkins = await db.walkins.find({"date": d}).to_list(1000)
        trend.append({
            "date": d,
            "offline": sum(b.get("total", 0) for b in d_bills),
            "online": sum(o.get("net_sales", 0) for o in d_online),
            "revenue": sum(b.get("total", 0) for b in d_bills) + sum(o.get("net_sales", 0) for o in d_online),
            "walkins": len(d_walkins),
            "guests": sum(w.get("num_guests", 1) for w in d_walkins),
            "bills": len(d_bills),
        })

    # Recent bills
    recent = await db.bills.find({"date": today, "is_voided": {"$ne": True}}).sort("created_at", -1).limit(5).to_list(5)
    for b in recent:
        b["id"] = str(b.pop("_id"))

    # Monthly totals
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
async def get_analytics(request: Request, from_date: Optional[str] = None, to_date: Optional[str] = None, days: int = 30):
    db = get_db()
    await get_current_user(request, db)

    end = to_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if from_date:
        start = from_date
    else:
        start = (datetime.now(timezone.utc) - timedelta(days=days - 1)).strftime("%Y-%m-%d")

    rows = []
    cur = datetime.strptime(start, "%Y-%m-%d")
    end_dt = datetime.strptime(end, "%Y-%m-%d")
    while cur <= end_dt:
        d = cur.strftime("%Y-%m-%d")
        d_bills = await db.bills.find({"date": d, "is_voided": {"$ne": True}}).to_list(1000)
        d_online = await db.online_sales.find({"date": d}).to_list(1000)
        d_walkins = await db.walkins.find({"date": d}).to_list(1000)
        platform_map = {}
        for o in d_online:
            p = o.get("platform", "other")
            platform_map[p] = platform_map.get(p, 0) + o.get("net_sales", 0)
        rows.append({
            "date": d,
            "offline_revenue": sum(b.get("total", 0) for b in d_bills),
            "online_revenue": sum(o.get("net_sales", 0) for o in d_online),
            "total_revenue": sum(b.get("total", 0) for b in d_bills) + sum(o.get("net_sales", 0) for o in d_online),
            "bills": len(d_bills),
            "walkins": len(d_walkins),
            "guests": sum(w.get("num_guests", 1) for w in d_walkins),
            "cash": sum(b.get("cash_amount", 0) for b in d_bills),
            "upi": sum(b.get("upi_amount", 0) for b in d_bills),
            "platforms": platform_map,
        })
        cur += timedelta(days=1)
    return rows
