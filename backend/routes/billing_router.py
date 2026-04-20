from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


class BillItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int
    subtotal: float


class BillCreate(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    items: List[BillItem]
    payment_mode: str
    cash_amount: float = 0.0
    upi_amount: float = 0.0


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def get_bills(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bills = await db.bills.find({"date": today}).sort("created_at", -1).to_list(1000)
    return [serialize(b) for b in bills]


@router.post("")
async def create_bill(input: BillCreate, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc)

    subtotal = sum(item.subtotal for item in input.items)
    total = subtotal

    if input.payment_mode == "cash":
        cash_amount = total
        upi_amount = 0.0
    elif input.payment_mode == "upi":
        cash_amount = 0.0
        upi_amount = total
    else:
        cash_amount = input.cash_amount
        upi_amount = input.upi_amount

    today_str = now.strftime("%Y-%m-%d")
    count = await db.bills.count_documents({"date": today_str})
    bill_number = f"DB{now.strftime('%Y%m%d')}{count + 1:04d}"

    doc = {
        "bill_number": bill_number,
        "customer_name": input.customer_name,
        "customer_phone": input.customer_phone,
        "items": [item.model_dump() for item in input.items],
        "subtotal": subtotal,
        "total": total,
        "payment_mode": input.payment_mode,
        "cash_amount": cash_amount,
        "upi_amount": upi_amount,
        "date": today_str,
        "created_at": now.isoformat(),
        "created_by": user.get("id") or user.get("_id"),
    }
    result = await db.bills.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.get("/stats")
async def get_stats(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bills = await db.bills.find({"date": today}).to_list(1000)
    return {
        "total_bills": len(bills),
        "total_revenue": sum(b.get("total", 0) for b in bills),
        "cash_revenue": sum(b.get("cash_amount", 0) for b in bills),
        "upi_revenue": sum(b.get("upi_amount", 0) for b in bills),
        "date": today,
    }


@router.get("/{bill_id}")
async def get_bill(bill_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    bill = await db.bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(404, "Bill not found")
    return serialize(bill)
