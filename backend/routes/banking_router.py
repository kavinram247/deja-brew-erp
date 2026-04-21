from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


class BankingCreate(BaseModel):
    amount: float
    depositor_name: str
    notes: Optional[str] = None


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def get_entries(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    docs = await db.banking.find({"date": today}).sort("created_at", -1).to_list(1000)
    return [serialize(d) for d in docs]


@router.get("/all")
async def get_all(request: Request):
    db = get_db()
    await get_current_user(request, db)
    docs = await db.banking.find({}).sort("created_at", -1).limit(200).to_list(200)
    return [serialize(d) for d in docs]


@router.post("")
async def add_entry(input: BankingCreate, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc)
    doc = {
        "date": now.strftime("%Y-%m-%d"),
        "time": now.isoformat(),
        "amount": input.amount,
        "depositor_name": input.depositor_name,
        "notes": input.notes,
        "created_by": user.get("id"),
        "created_by_name": user.get("name"),
        "created_at": now.isoformat(),
    }
    result = await db.banking.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.delete("/{entry_id}")
async def delete_entry(entry_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    await db.banking.delete_one({"_id": ObjectId(entry_id)})
    return {"message": "Deleted"}
