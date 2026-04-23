from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()

TAX_RATE = 0.025  # 2.5% CGST + 2.5% SGST


class BillItemCreate(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int
    item_discount_pct: float = 0.0


class BillCreate(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    items: List[BillItemCreate]
    overall_discount: float = 0.0
    payment_mode: str
    cash_amount: float = 0.0
    upi_amount: float = 0.0


def calc_item(item: BillItemCreate) -> dict:
    gross = round(item.price * item.quantity, 2)
    disc = round(gross * item.item_discount_pct / 100, 2)
    return {
        "menu_item_id": item.menu_item_id, "name": item.name,
        "price": item.price, "quantity": item.quantity,
        "item_discount_pct": item.item_discount_pct,
        "gross": gross, "item_discount": disc,
        "subtotal": round(gross - disc, 2),
    }


async def deduct_inventory(db, items: list, bill_id: str) -> list:
    deductions = []
    for item in items:
        recipe = await db.recipes.find_one({"menu_item_id": item["menu_item_id"]})
        if not recipe:
            continue
        for ing in recipe.get("ingredients", []):
            qty = round(ing["quantity"] * item["quantity"], 6)
            try:
                await db.inventory.update_one(
                    {"_id": ObjectId(ing["inventory_item_id"])},
                    {"$inc": {"current_stock": -qty}},
                )
                deductions.append({
                    "inventory_item_id": ing["inventory_item_id"],
                    "item_name": ing["item_name"],
                    "quantity_deducted": qty,
                    "unit": ing.get("unit", ""),
                })
            except Exception:
                pass
    return deductions


def serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def get_bills(request: Request, date_str: Optional[str] = None):
    db = get_db()
    await get_current_user(request, db)
    today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bills = await db.bills.find({"date": today}).sort("created_at", -1).to_list(1000)
    return [serialize(b) for b in bills]


@router.post("")
async def create_bill(input: BillCreate, request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc)

    calc_items = [calc_item(i) for i in input.items]
    subtotal = round(sum(i["subtotal"] for i in calc_items), 2)
    taxable = round(max(0, subtotal - input.overall_discount), 2)
    cgst = round(taxable * TAX_RATE, 2)
    sgst = round(taxable * TAX_RATE, 2)
    total = round(taxable + cgst + sgst, 2)

    if input.payment_mode == "cash":
        cash, upi = total, 0.0
    elif input.payment_mode == "upi":
        cash, upi = 0.0, total
    else:
        cash, upi = input.cash_amount, input.upi_amount

    today_str = now.strftime("%Y-%m-%d")
    count = await db.bills.count_documents({"date": today_str})
    bill_number = f"DB{now.strftime('%Y%m%d')}{count + 1:04d}"

    doc = {
        "bill_number": bill_number,
        "customer_name": input.customer_name,
        "customer_phone": input.customer_phone,
        "items": calc_items,
        "subtotal": subtotal,
        "overall_discount": input.overall_discount,
        "taxable_amount": taxable,
        "cgst": cgst, "sgst": sgst, "total": total,
        "payment_mode": input.payment_mode,
        "cash_amount": cash, "upi_amount": upi,
        "date": today_str,
        "created_at": now.isoformat(),
        "created_by": user.get("id"),
        "is_voided": False,
        "inventory_deductions": [],
    }
    result = await db.bills.insert_one(doc)
    deductions = await deduct_inventory(db, calc_items, str(result.inserted_id))
    if deductions:
        await db.bills.update_one(
            {"_id": result.inserted_id},
            {"$set": {"inventory_deductions": deductions}},
        )
    doc["_id"] = result.inserted_id
    doc["inventory_deductions"] = deductions
    return serialize(doc)


@router.get("/{bill_id}")
async def get_bill(bill_id: str, request: Request):
    db = get_db()
    await get_current_user(request, db)
    bill = await db.bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(404, "Bill not found")
    return serialize(bill)
