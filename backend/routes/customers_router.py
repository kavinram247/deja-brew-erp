from fastapi import APIRouter, Request
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


@router.get("")
async def list_customers(request: Request):
    db = get_db()
    await get_current_user(request, db)

    pipeline = [
        {"$match": {"$or": [
            {"customer_phone": {"$nin": [None, ""]}},
            {"customer_name":  {"$nin": [None, ""]}},
        ]}},
        {"$group": {
            "_id": {"$cond": {
                "if":   {"$ne": [{"$trim": {"input": {"$ifNull": ["$customer_phone", ""]}}}, ""]},
                "then": {"$trim": {"input": "$customer_phone"}},
                "else": {"$concat": ["name:", {"$toLower": {"$trim": {"input": {"$ifNull": ["$customer_name", ""]}}}}]},
            }},
            "name":        {"$last": {"$trim": {"input": {"$ifNull": ["$customer_name", ""]}}}},
            "phone":       {"$last": {"$trim": {"input": {"$ifNull": ["$customer_phone", ""]}}}},
            "first_visit": {"$min": "$created_at"},
            "last_visit":  {"$max": "$created_at"},
            "visit_count": {"$sum": 1},
            "total_spent": {"$sum": {"$ifNull": ["$total", 0]}},
        }},
        {"$project": {
            "_id": 0,
            "name":        {"$cond": [{"$eq": ["$name", ""]}, "—", "$name"]},
            "phone":       1,
            "first_visit": {"$substr": [{"$ifNull": ["$first_visit", ""]}, 0, 10]},
            "last_visit":  {"$substr": [{"$ifNull": ["$last_visit", ""]}, 0, 10]},
            "visit_count": 1,
            "is_repeat":   {"$gt": ["$visit_count", 1]},
            "total_spent": {"$round": ["$total_spent", 2]},
        }},
        {"$sort": {"last_visit": -1}},
    ]

    return await db.bills.aggregate(pipeline).to_list(None)
