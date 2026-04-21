from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


class InventoryItemCreate(BaseModel):
    name: str
    category: str
    section: str = "Other"   # Barista / Kitchen / Other
    current_stock: float
    unit: str
    min_quantity: float
    cost_per_unit: float


class StockAdjust(BaseModel):
    adjustment: float    # positive = add, negative = reduce
    notes: Optional[str] = None


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def get_inventory(request: Request, section: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    query = {"section": section} if section and section != "All" else {}
    items = await db.inventory.find(query).sort([("section", 1), ("name", 1)]).to_list(1000)
    return [serialize(i) for i in items]


@router.post("")
async def create_item(input: InventoryItemCreate, request: Request):
    db = get_db()
    await get_current_user(request, db)
    doc = input.model_dump()
    doc["last_updated"] = datetime.now(timezone.utc).isoformat()
    result = await db.inventory.insert_one(doc)
    item = await db.inventory.find_one({"_id": result.inserted_id})
    return serialize(item)


@router.put("/{item_id}")
async def update_item(item_id: str, input: InventoryItemCreate, request: Request):
    db = get_db()
    await get_current_user(request, db)
    update = input.model_dump()
    update["last_updated"] = datetime.now(timezone.utc).isoformat()
    await db.inventory.update_one({"_id": ObjectId(item_id)}, {"$set": update})
    item = await db.inventory.find_one({"_id": ObjectId(item_id)})
    return serialize(item)


@router.delete("/{item_id}")
async def delete_item(item_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    await db.inventory.delete_one({"_id": ObjectId(item_id)})
    return {"message": "Deleted"}


@router.post("/{item_id}/adjust")
async def adjust_stock(item_id: str, input: StockAdjust, request: Request):
    db = get_db()
    await get_current_user(request, db)
    await db.inventory.update_one(
        {"_id": ObjectId(item_id)},
        {"$inc": {"current_stock": input.adjustment},
         "$set": {"last_updated": datetime.now(timezone.utc).isoformat()}},
    )
    item = await db.inventory.find_one({"_id": ObjectId(item_id)})
    return serialize(item)


@router.post("/{item_id}/set-stock")
async def set_stock(item_id: str, input: StockAdjust, request: Request):
    """Set stock to exact value (positive adjustment = new stock value)"""
    db = get_db()
    await get_current_user(request, db)
    await db.inventory.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"current_stock": input.adjustment,
                  "last_updated": datetime.now(timezone.utc).isoformat()}},
    )
    item = await db.inventory.find_one({"_id": ObjectId(item_id)})
    return serialize(item)
