from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()

PLATFORMS = ["swiggy", "zomato", "district"]


class OnlineSaleCreate(BaseModel):
    platform: str
    gross_sales: float
    net_sales: float
    cash_amount: float = 0.0
    upi_amount: float = 0.0
    card_amount: float = 0.0
    notes: Optional[str] = None


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def get_sales(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    docs = await db.online_sales.find({"date": today}).sort("timestamp", -1).to_list(1000)
    return [serialize(d) for d in docs]


@router.post("")
async def add_sale(input: OnlineSaleCreate, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc)
    doc = {
        "date": now.strftime("%Y-%m-%d"),
        "platform": input.platform.lower(),
        "gross_sales": input.gross_sales,
        "net_sales": input.net_sales,
        "cash_amount": input.cash_amount,
        "upi_amount": input.upi_amount,
        "card_amount": input.card_amount,
        "notes": input.notes,
        "timestamp": now.isoformat(),
        "created_by": user.get("id"),
    }
    result = await db.online_sales.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.delete("/{sale_id}")
async def delete_sale(sale_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    await db.online_sales.delete_one({"_id": ObjectId(sale_id)})
    return {"message": "Deleted"}
