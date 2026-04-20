from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


class WalkInCreate(BaseModel):
    customer_name: Optional[str] = "Guest"
    customer_phone: Optional[str] = None
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
    items = await db.walkins.find({"date": today}).sort("time_in", 1).to_list(1000)
    return [serialize(w) for w in items]


@router.post("")
async def create_walkin(input: WalkInCreate, request: Request):
    db = get_db()
    await get_current_user(request, db)
    now = datetime.now(timezone.utc)
    doc = {
        "customer_name": input.customer_name or "Guest",
        "customer_phone": input.customer_phone,
        "time_in": now.isoformat(),
        "time_out": None,
        "date": now.strftime("%Y-%m-%d"),
        "notes": input.notes,
    }
    result = await db.walkins.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.put("/{walkin_id}/checkout")
async def checkout(walkin_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    now = datetime.now(timezone.utc)
    result = await db.walkins.update_one(
        {"_id": ObjectId(walkin_id), "time_out": None},
        {"$set": {"time_out": now.isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Walk-in not found or already checked out")
    doc = await db.walkins.find_one({"_id": ObjectId(walkin_id)})
    return serialize(doc)


@router.delete("/{walkin_id}")
async def delete_walkin(walkin_id: str, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    if user.get("role") != "owner":
        raise HTTPException(403, "Owner access required")
    await db.walkins.delete_one({"_id": ObjectId(walkin_id)})
    return {"message": "Deleted"}


@router.get("/stats")
async def get_stats(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total = await db.walkins.count_documents({"date": today})
    active = await db.walkins.count_documents({"date": today, "time_out": None})
    return {"total": total, "active": active, "date": today}
