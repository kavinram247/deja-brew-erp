from fastapi import APIRouter, Request
from datetime import datetime
from collections import defaultdict
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


@router.get("")
async def list_customers(request: Request):
    """
    Aggregate customers from all bills by phone (or name if no phone).
    Returns: name, phone, first_visit, last_visit, visit_count, total_spent, is_repeat
    """
    db = get_db()
    await get_current_user(request, db)
    bills = await db.bills.find({}, {
        "_id": 0, "customer_name": 1, "customer_phone": 1,
        "total": 1, "created_at": 1, "bill_number": 1,
    }).to_list(50000)

    # Group: phone (preferred) else name
    groups = defaultdict(lambda: {"visits": [], "total_spent": 0.0})
    for b in bills:
        name = (b.get("customer_name") or "").strip()
        phone = (b.get("customer_phone") or "").strip()
        if not name and not phone:
            continue
        key = phone or f"name:{name.lower()}"
        groups[key]["name"] = name or "—"
        groups[key]["phone"] = phone or ""
        groups[key]["visits"].append(b.get("created_at"))
        groups[key]["total_spent"] += float(b.get("total") or 0)

    customers = []
    for key, g in groups.items():
        visits = sorted([v for v in g["visits"] if v])
        first = visits[0] if visits else None
        last = visits[-1] if visits else None
        first_date = first[:10] if first else ""
        last_date = last[:10] if last else ""
        count = len(visits)
        customers.append({
            "name": g.get("name", "—"),
            "phone": g.get("phone", ""),
            "first_visit": first_date,
            "last_visit": last_date,
            "visit_count": count,
            "is_repeat": count > 1,
            "total_spent": round(g["total_spent"], 2),
        })

    customers.sort(key=lambda c: c["last_visit"], reverse=True)
    return customers
