from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from datetime import datetime, timezone

from database import init_db, close_db
from auth_utils import hash_password, verify_password
from routes.auth_router import router as auth_router
from routes.walkins_router import router as walkins_router
from routes.menu_router import router as menu_router
from routes.billing_router import router as billing_router
from routes.inventory_router import router as inventory_router
from routes.float_router import router as float_router
from routes.dashboard_router import router as dashboard_router
from routes.users_router import router as users_router
from routes.recipes_router import router as recipes_router
from routes.online_sales_router import router as online_sales_router
from routes.routines_router import router as routines_router
from routes.banking_router import router as banking_router
from routes.misc_payments_router import router as misc_payments_router
from routes.customers_router import router as customers_router

app = FastAPI(title="Deja Brew ERP", redirect_slashes=False)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
# Support comma-separated list of allowed origins (for preview + prod Vercel URLs)
extra_origins = os.environ.get("ALLOWED_ORIGINS", "")
origins = [o.strip() for o in frontend_url.split(",") if o.strip()]
origins += [o.strip() for o in extra_origins.split(",") if o.strip()]
if "http://localhost:3000" not in origins:
    origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

@api_router.get("/")
async def root():
    return {"message": "Deja Brew ERP API v2"}

app.include_router(api_router)
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(walkins_router, prefix="/api/walkins", tags=["walkins"])
app.include_router(menu_router, prefix="/api/menu", tags=["menu"])
app.include_router(billing_router, prefix="/api/bills", tags=["billing"])
app.include_router(inventory_router, prefix="/api/inventory", tags=["inventory"])
app.include_router(float_router, prefix="/api/float", tags=["purchases"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(recipes_router, prefix="/api/recipes", tags=["recipes"])
app.include_router(online_sales_router, prefix="/api/online-sales", tags=["online-sales"])
app.include_router(routines_router, prefix="/api/routines", tags=["routines"])
app.include_router(banking_router, prefix="/api/banking", tags=["banking"])
app.include_router(misc_payments_router, prefix="/api/misc-payments", tags=["misc-payments"])
app.include_router(customers_router, prefix="/api/customers", tags=["customers"])

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    db = await init_db()

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.walkins.create_index("date")
    await db.bills.create_index("date")
    await db.float_days.create_index("date", unique=True)
    await db.inventory.create_index("name")
    await db.recipes.create_index("menu_item_id", unique=True)
    await db.online_sales.create_index("date")
    await db.routine_executions.create_index("date")
    await db.banking.create_index("date")

    # Migrate inventory: rename 'quantity' to 'current_stock', add 'section'
    items = await db.inventory.find(
        {"quantity": {"$exists": True}, "current_stock": {"$exists": False}}
    ).to_list(1000)
    for item in items:
        await db.inventory.update_one(
            {"_id": item["_id"]},
            {"$set": {"current_stock": item.get("quantity", 0), "section": item.get("section", "Other")},
             "$unset": {"quantity": ""}},
        )
    await db.inventory.update_many({"section": {"$exists": False}}, {"$set": {"section": "Other"}})

    # Seed owner
    admin_email = os.environ.get("ADMIN_EMAIL", "owner@dejabrew.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "BrewOwner2024")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email, "password_hash": hashed,
            "name": "Owner", "role": "owner",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Created owner: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )

    os.makedirs("/tmp/memory", exist_ok=True)
    with open("/tmp/memory/test_credentials.md", "w") as f:
        f.write(f"""# Deja Brew ERP v2 - Test Credentials

## Owner Account
- Email: {admin_email}
- Password: {admin_password}
- Role: owner → redirects to /dashboard/overview

## Employee Account (create via Settings)
- Role: employee → redirects to /entry/walkins

## Route Structure
- /entry/* — Employee operations (Walk-ins, Online Sales, Purchases, Inventory, Billing, Routines, Menu)
- /dashboard/* — Owner analytics (Overview, Sales, Purchases, Inventory, Billing+Void, Banking, Settings)
""")


@app.on_event("shutdown")
async def shutdown_db_client():
    close_db()
