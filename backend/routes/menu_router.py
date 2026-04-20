from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


class MenuItemCreate(BaseModel):
    name: str
    category: str
    price: float
    description: Optional[str] = None
    active: bool = True


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def get_menu(request: Request, active_only: bool = False):
    db = get_db()
    await get_current_user(request, db)
    query = {"active": True} if active_only else {}
    items = await db.menu_items.find(query).sort([("category", 1), ("name", 1)]).to_list(1000)
    return [serialize(i) for i in items]


@router.post("")
async def create_item(input: MenuItemCreate, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    if user.get("role") != "owner":
        raise HTTPException(403, "Owner access required")
    result = await db.menu_items.insert_one(input.model_dump())
    item = await db.menu_items.find_one({"_id": result.inserted_id})
    return serialize(item)


@router.put("/{item_id}")
async def update_item(item_id: str, input: MenuItemCreate, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    if user.get("role") != "owner":
        raise HTTPException(403, "Owner access required")
    await db.menu_items.update_one({"_id": ObjectId(item_id)}, {"$set": input.model_dump()})
    item = await db.menu_items.find_one({"_id": ObjectId(item_id)})
    return serialize(item)


@router.delete("/{item_id}")
async def delete_item(item_id: str, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    if user.get("role") != "owner":
        raise HTTPException(403, "Owner access required")
    await db.menu_items.delete_one({"_id": ObjectId(item_id)})
    return {"message": "Deleted"}
