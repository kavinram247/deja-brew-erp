from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()

CATEGORIES = ["Tips", "Scrap Sale", "Refund Received", "Deposit Refund", "Reimbursement", "Other"]


class MiscPaymentCreate(BaseModel):
    amount: float
    source: str                     # who paid / where from
    category: str = "Other"
    payment_mode: str = "cash"      # cash / upi / other
    notes: Optional[str] = None
    date: Optional[str] = None      # YYYY-MM-DD, defaults to today


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def list_payments(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    docs = await db.misc_payments.find({"date": today}).sort("created_at", -1).to_list(500)
    return [serialize(d) for d in docs]


@router.get("/all")
async def list_all(request: Request, limit: int = 200):
    db = get_db()
    await get_current_user(request, db)
    docs = await db.misc_payments.find({}).sort("created_at", -1).limit(limit).to_list(limit)
    return [serialize(d) for d in docs]


@router.post("")
async def add_payment(input: MiscPaymentCreate, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc)
    date_str = input.date or now.strftime("%Y-%m-%d")
    doc = {
        "date": date_str,
        "amount": input.amount,
        "source": input.source,
        "category": input.category,
        "payment_mode": input.payment_mode,
        "notes": input.notes,
        "time": now.isoformat(),
        "created_at": now.isoformat(),
        "created_by": user.get("id"),
        "created_by_name": user.get("name"),
    }
    result = await db.misc_payments.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.delete("/{entry_id}")
async def delete_payment(entry_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    await db.misc_payments.delete_one({"_id": ObjectId(entry_id)})
    return {"message": "Deleted"}
