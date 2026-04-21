from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Optional
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


class RecipeIngredient(BaseModel):
    inventory_item_id: str
    item_name: str
    quantity: float
    unit: str


class RecipeCreate(BaseModel):
    menu_item_id: str
    menu_item_name: str
    ingredients: List[RecipeIngredient]


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def get_all(request: Request):
    db = get_db()
    await get_current_user(request, db)
    docs = await db.recipes.find({}).to_list(1000)
    return [serialize(d) for d in docs]


@router.get("/{menu_item_id}")
async def get_recipe(menu_item_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    doc = await db.recipes.find_one({"menu_item_id": menu_item_id})
    return serialize(doc) if doc else None


@router.post("")
async def upsert_recipe(input: RecipeCreate, request: Request):
    db = get_db()
    await get_current_user(request, db)
    data = {
        "menu_item_id": input.menu_item_id,
        "menu_item_name": input.menu_item_name,
        "ingredients": [i.model_dump() for i in input.ingredients],
    }
    existing = await db.recipes.find_one({"menu_item_id": input.menu_item_id})
    if existing:
        await db.recipes.update_one({"menu_item_id": input.menu_item_id}, {"$set": data})
        doc = await db.recipes.find_one({"menu_item_id": input.menu_item_id})
    else:
        result = await db.recipes.insert_one(data)
        doc = await db.recipes.find_one({"_id": result.inserted_id})
    return serialize(doc)


@router.delete("/{menu_item_id}")
async def delete_recipe(menu_item_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    await db.recipes.delete_one({"menu_item_id": menu_item_id})
    return {"message": "Recipe deleted"}
