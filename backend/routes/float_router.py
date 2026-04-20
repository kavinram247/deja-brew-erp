from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import get_db
from auth_utils import get_current_user
import uuid

router = APIRouter()

FLOAT_OPENING = 5200.0


class FloatExpenseCreate(BaseModel):
    description: str
    amount: float
    category: str


def calc_closing(opening: float, expenses: list) -> float:
    return round(opening - sum(e.get("amount", 0) for e in expenses), 2)


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


async def get_or_create(db, date_str: str) -> dict:
    doc = await db.float_days.find_one({"date": date_str})
    if not doc:
        new_doc = {
            "date": date_str,
            "opening_balance": FLOAT_OPENING,
            "expenses": [],
            "closing_balance": FLOAT_OPENING,
            "notes": None,
        }
        result = await db.float_days.insert_one(new_doc)
        new_doc["_id"] = result.inserted_id
        return new_doc
    return doc


@router.get("/today")
async def get_today(request: Request):
    db = get_db()
    await get_current_user(request, db)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = await get_or_create(db, today)
    return serialize(doc)


@router.get("/history")
async def get_history(request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    if user.get("role") != "owner":
        raise HTTPException(403, "Owner access required")
    docs = await db.float_days.find({}).sort("date", -1).limit(30).to_list(30)
    return [serialize(d) for d in docs]


@router.get("")
async def get_by_date(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    target = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = await get_or_create(db, target)
    return serialize(doc)


@router.post("/expenses")
async def add_expense(input: FloatExpenseCreate, request: Request):
    db = get_db()
    await get_current_user(request, db)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = await get_or_create(db, today)

    expense = {
        "id": str(uuid.uuid4()),
        "description": input.description,
        "amount": input.amount,
        "category": input.category,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    updated_expenses = doc.get("expenses", []) + [expense]
    new_closing = calc_closing(doc["opening_balance"], updated_expenses)

    await db.float_days.update_one(
        {"date": today},
        {"$push": {"expenses": expense}, "$set": {"closing_balance": new_closing}},
    )
    updated = await db.float_days.find_one({"date": today})
    return serialize(updated)


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = await get_or_create(db, today)

    remaining = [e for e in doc.get("expenses", []) if e["id"] != expense_id]
    new_closing = calc_closing(doc["opening_balance"], remaining)

    await db.float_days.update_one(
        {"date": today},
        {"$set": {"expenses": remaining, "closing_balance": new_closing}},
    )
    updated = await db.float_days.find_one({"date": today})
    return serialize(updated)
