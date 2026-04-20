from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from datetime import datetime, timezone

from database import init_db, close_db, get_db
from auth_utils import hash_password, verify_password
from routes.auth_router import router as auth_router
from routes.walkins_router import router as walkins_router
from routes.menu_router import router as menu_router
from routes.billing_router import router as billing_router
from routes.inventory_router import router as inventory_router
from routes.float_router import router as float_router
from routes.dashboard_router import router as dashboard_router
from routes.users_router import router as users_router

app = FastAPI(title="Deja Brew ERP", redirect_slashes=False)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Deja Brew ERP API"}


app.include_router(api_router)
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(walkins_router, prefix="/api/walkins", tags=["walkins"])
app.include_router(menu_router, prefix="/api/menu", tags=["menu"])
app.include_router(billing_router, prefix="/api/bills", tags=["billing"])
app.include_router(inventory_router, prefix="/api/inventory", tags=["inventory"])
app.include_router(float_router, prefix="/api/float", tags=["float"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(users_router, prefix="/api/users", tags=["users"])

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    db = await init_db()

    await db.users.create_index("email", unique=True)
    await db.walkins.create_index("date")
    await db.bills.create_index("date")
    await db.float_days.create_index("date", unique=True)
    await db.inventory.create_index("name")

    admin_email = os.environ.get("ADMIN_EMAIL", "owner@dejabrew.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "BrewOwner2024")

    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one(
            {
                "email": admin_email,
                "password_hash": hashed,
                "name": "Owner",
                "role": "owner",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        logger.info(f"Created owner account: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
        logger.info("Updated owner password")

    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(
            f"""# Deja Brew ERP - Test Credentials

## Owner Account
- Email: {admin_email}
- Password: {admin_password}
- Role: owner (full access to all features)

## Auth Endpoints
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/register (owner only, creates employees)
- POST /api/auth/refresh

## Notes
- Owner can create employees via Settings page or POST /api/auth/register
- Employee role: Dashboard, Walk-ins, Billing, Float
- Owner role: All pages including Inventory, Menu, Reports, Settings
"""
        )


@app.on_event("shutdown")
async def shutdown_db_client():
    close_db()
