from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


class RoutineIngredient(BaseModel):
    inventory_item_id: str
    item_name: str
    quantity: float
    unit: str


class RoutineCreate(BaseModel):
    name: str
    description: Optional[str] = None
    ingredients: List[RoutineIngredient]


class ExecuteInput(BaseModel):
    notes: Optional[str] = None


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def get_routines(request: Request):
    db = get_db()
    await get_current_user(request, db)
    docs = await db.routines.find({}).sort("name", 1).to_list(1000)
    return [serialize(d) for d in docs]


@router.get("/executions")
async def get_executions(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    docs = await db.routine_executions.find({"date": today}).sort("executed_at", -1).to_list(200)
    return [serialize(d) for d in docs]


@router.post("")
async def create_routine(input: RoutineCreate, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    doc = {
        "name": input.name,
        "description": input.description,
        "ingredients": [i.model_dump() for i in input.ingredients],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("id"),
    }
    result = await db.routines.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.put("/{routine_id}")
async def update_routine(routine_id: str, input: RoutineCreate, request: Request):
    db = get_db()
    await get_current_user(request, db)
    update = {
        "name": input.name,
        "description": input.description,
        "ingredients": [i.model_dump() for i in input.ingredients],
    }
    await db.routines.update_one({"_id": ObjectId(routine_id)}, {"$set": update})
    doc = await db.routines.find_one({"_id": ObjectId(routine_id)})
    return serialize(doc)


@router.delete("/{routine_id}")
async def delete_routine(routine_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    await db.routines.delete_one({"_id": ObjectId(routine_id)})
    return {"message": "Deleted"}


@router.post("/{routine_id}/execute")
async def execute_routine(routine_id: str, input: ExecuteInput, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    routine = await db.routines.find_one({"_id": ObjectId(routine_id)})
    if not routine:
        raise HTTPException(404, "Routine not found")

    now = datetime.now(timezone.utc)
    deductions = []
    for ing in routine.get("ingredients", []):
        try:
            await db.inventory.update_one(
                {"_id": ObjectId(ing["inventory_item_id"])},
                {"$inc": {"current_stock": -ing["quantity"]},
                 "$set": {"last_updated": now.isoformat()}},
            )
            deductions.append({
                "inventory_item_id": ing["inventory_item_id"],
                "item_name": ing["item_name"],
                "quantity_deducted": ing["quantity"],
                "unit": ing.get("unit", ""),
            })
        except Exception:
            pass

    exec_doc = {
        "routine_id": routine_id,
        "routine_name": routine["name"],
        "date": now.strftime("%Y-%m-%d"),
        "executed_at": now.isoformat(),
        "executed_by": user.get("id"),
        "executed_by_name": user.get("name"),
        "deductions": deductions,
        "notes": input.notes,
    }
    result = await db.routine_executions.insert_one(exec_doc)
    exec_doc["_id"] = result.inserted_id
    return serialize(exec_doc)
