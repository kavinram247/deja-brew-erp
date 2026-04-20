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

    total_walkins = await db.walkins.count_documents({"date": today})
    active_walkins = await db.walkins.count_documents({"date": today, "time_out": None})

    bills = await db.bills.find({"date": today}).to_list(1000)
    total_revenue = sum(b.get("total", 0) for b in bills)
    total_bills = len(bills)
    cash_revenue = sum(b.get("cash_amount", 0) for b in bills)
    upi_revenue = sum(b.get("upi_amount", 0) for b in bills)

    ratio = round((total_bills / total_walkins * 100), 1) if total_walkins > 0 else 0

    float_day = await db.float_days.find_one({"date": today})
    float_balance = float_day["closing_balance"] if float_day else 5200.0
    float_spent = 5200.0 - float_balance if float_day else 0.0

    low_stock = await db.inventory.count_documents(
        {"$expr": {"$lte": ["$quantity", "$min_quantity"]}}
    )

    trend = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        day_bills = await db.bills.find({"date": d}).to_list(1000)
        day_walkins = await db.walkins.count_documents({"date": d})
        trend.append(
            {
                "date": d,
                "revenue": sum(b.get("total", 0) for b in day_bills),
                "walkins": day_walkins,
                "bills": len(day_bills),
            }
        )

    recent_bills = await db.bills.find({"date": today}).sort("created_at", -1).limit(5).to_list(5)
    for b in recent_bills:
        b["id"] = str(b.pop("_id"))

    return {
        "date": today,
        "walkins": {"total": total_walkins, "active": active_walkins},
        "bills": {
            "total": total_bills,
            "revenue": total_revenue,
            "cash": cash_revenue,
            "upi": upi_revenue,
        },
        "billing_headcount_ratio": ratio,
        "float": {"balance": float_balance, "spent": float_spent},
        "low_stock_count": low_stock,
        "trend": trend,
        "recent_bills": recent_bills,
    }
