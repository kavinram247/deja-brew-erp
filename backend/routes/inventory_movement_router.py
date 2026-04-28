"""Inventory Movement Tracker — daily OPEN/NEW/USED/CLOSE per item.

Independent of the recipe-driven inventory deduction system. The owner/employee
manually enters NEW (received) and CLOSE per day; OPEN auto-carries from the
previous day's CLOSE; USED = OPEN + NEW - CLOSE.

Storage: one document per (inventory_item_id, date). Fields: new_received,
closing. Optional opening_seed for the very first day a user wants to seed.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, date as date_cls
from calendar import monthrange
from bson import ObjectId
from database import get_db
from auth_utils import get_current_user

router = APIRouter()


class CellUpdate(BaseModel):
    inventory_item_id: str
    date: str  # YYYY-MM-DD
    field: str  # one of: opening, new_received, closing
    value: Optional[float] = None  # null clears the cell


def _serialize_item(doc):
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "unit": doc.get("unit", ""),
        "section": doc.get("section", "Other"),
        "category": doc.get("category", ""),
    }


def _month_dates(year: int, month: int):
    last = monthrange(year, month)[1]
    return [f"{year:04d}-{month:02d}-{d:02d}" for d in range(1, last + 1)]


def _prev_date(ymd: str) -> str:
    y, m, d = map(int, ymd.split("-"))
    if d > 1:
        return f"{y:04d}-{m:02d}-{d - 1:02d}"
    if m > 1:
        last = monthrange(y, m - 1)[1]
        return f"{y:04d}-{m - 1:02d}-{last:02d}"
    return f"{y - 1:04d}-12-31"


@router.get("")
async def get_month_grid(request: Request, month: str):
    """Returns OPEN/NEW/USED/CLOSE for every inventory item × every day of month.

    `month` format: YYYY-MM. OPEN auto-carries from previous day's CLOSE.
    Day-1 OPEN comes from previous month's last-day CLOSE if recorded.
    """
    db = get_db()
    await get_current_user(request, db)

    try:
        year, mm = map(int, month.split("-"))
    except Exception:
        raise HTTPException(400, "month must be YYYY-MM")

    days = _month_dates(year, mm)
    items = await db.inventory.find({}).sort([("section", 1), ("name", 1)]).to_list(2000)

    # Pull all movements for these items in this month + day before month-start (for carry-over)
    item_ids = [str(i["_id"]) for i in items]
    prev_day = _prev_date(days[0])
    movements = await db.inventory_movements.find({
        "inventory_item_id": {"$in": item_ids},
        "date": {"$gte": prev_day, "$lte": days[-1]},
    }).to_list(20000)

    # Index: { item_id: { date: { new_received, closing, opening_seed } } }
    by_item = {}
    for m in movements:
        by_item.setdefault(m["inventory_item_id"], {})[m["date"]] = m

    rows = []
    for it in items:
        item_id = str(it["_id"])
        item_data = by_item.get(item_id, {})

        # Day-0 carry: previous day's closing (or prior closing in month if cascading)
        prev_close = None
        prev_doc = item_data.get(prev_day)
        if prev_doc and prev_doc.get("closing") is not None:
            prev_close = prev_doc["closing"]

        day_cells = []
        carry = prev_close
        for d in days:
            doc = item_data.get(d, {})
            seed = doc.get("opening_seed")
            new_received = doc.get("new_received")
            closing = doc.get("closing")

            # OPEN: explicit seed > carry from prev day's close > null
            if seed is not None:
                opening = seed
            elif carry is not None:
                opening = carry
            else:
                opening = None

            # USED computed only when OPEN and CLOSE both present
            if opening is not None and closing is not None:
                used = round(opening + (new_received or 0) - closing, 4)
            else:
                used = None

            day_cells.append({
                "date": d,
                "opening": opening,
                "new_received": new_received,
                "used": used,
                "closing": closing,
                "has_seed": seed is not None,
            })
            # carry forward only if we have a closing for today
            carry = closing if closing is not None else opening

        rows.append({
            "item": _serialize_item(it),
            "days": day_cells,
        })

    return {"month": month, "dates": days, "rows": rows}


@router.put("/cell")
async def update_cell(input: CellUpdate, request: Request):
    """Upsert one cell. field ∈ {opening, new_received, closing}.

    `opening` writes to `opening_seed` (manual override). null/None clears it.
    """
    if input.field not in ("opening", "new_received", "closing"):
        raise HTTPException(400, "field must be opening | new_received | closing")

    db = get_db()
    await get_current_user(request, db)

    # Verify item exists
    item = await db.inventory.find_one({"_id": ObjectId(input.inventory_item_id)})
    if not item:
        raise HTTPException(404, "Inventory item not found")

    # Validate date format
    try:
        date_cls.fromisoformat(input.date)
    except ValueError:
        raise HTTPException(400, "date must be YYYY-MM-DD")

    db_field = "opening_seed" if input.field == "opening" else input.field

    update_op = {}
    if input.value is None:
        update_op["$unset"] = {db_field: ""}
    else:
        update_op["$set"] = {db_field: float(input.value)}
    update_op.setdefault("$set", {})["last_updated"] = datetime.now(timezone.utc).isoformat()

    await db.inventory_movements.update_one(
        {"inventory_item_id": input.inventory_item_id, "date": input.date},
        update_op,
        upsert=True,
    )
    return {"ok": True}
