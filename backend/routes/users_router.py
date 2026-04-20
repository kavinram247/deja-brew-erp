from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    return doc


@router.get("")
async def get_users(request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    if user.get("role") != "owner":
        raise HTTPException(403, "Owner access required")
    users = await db.users.find({}).to_list(1000)
    return [serialize(u) for u in users]


@router.delete("/{user_id}")
async def delete_user(user_id: str, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    if user.get("role") != "owner":
        raise HTTPException(403, "Owner access required")
    if user.get("id") == user_id:
        raise HTTPException(400, "Cannot delete yourself")
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"message": "User deleted"}
