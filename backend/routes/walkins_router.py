from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


class WalkInCreate(BaseModel):
    num_guests: int = 1
    payment_mode: str = "cash"   # cash / upi / split
    notes: Optional[str] = None


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def get_walkins(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    items = await db.walkins.find({"date": today}).sort("time", 1).to_list(1000)
    return [serialize(w) for w in items]


@router.post("")
async def create_walkin(input: WalkInCreate, request: Request):
    db = get_db()
    await get_current_user(request, db)
    now = datetime.now(timezone.utc)
    doc = {
        "num_guests": max(1, input.num_guests),
        "payment_mode": input.payment_mode,
        "notes": input.notes,
        "time": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
    }
    result = await db.walkins.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.delete("/{walkin_id}")
async def delete_walkin(walkin_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    await db.walkins.delete_one({"_id": ObjectId(walkin_id)})
    return {"message": "Deleted"}
