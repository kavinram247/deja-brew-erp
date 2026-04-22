from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import get_db
from auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_jwt_secret,
    JWT_ALGORITHM,
)
from cookie_utils import cookie_kwargs, delete_cookie_kwargs
from bson import ObjectId
import jwt

router = APIRouter()


class LoginInput(BaseModel):
    email: str
    password: str


class RegisterInput(BaseModel):
    email: str
    password: str
    name: str
    role: str = "employee"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie("access_token", access_token, **cookie_kwargs(36000))
    response.set_cookie("refresh_token", refresh_token, **cookie_kwargs(604800))


@router.post("/login")
async def login(input: LoginInput, response: Response):
    db = get_db()
    email = input.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(input.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    return {"id": user_id, "email": user["email"], "name": user["name"], "role": user["role"]}


@router.post("/logout")
async def logout(response: Response):
    kw = delete_cookie_kwargs()
    response.delete_cookie("access_token", **kw)
    response.delete_cookie("refresh_token", **kw)
    return {"message": "Logged out"}


@router.get("/me")
async def me(request: Request):
    db = get_db()
    user = await get_current_user(request, db)
    return user


@router.post("/register")
async def register(input: RegisterInput, request: Request):
    db = get_db()
    current_user = await get_current_user(request, db)
    if current_user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only owner can create users")
    email = input.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(input.password)
    result = await db.users.insert_one(
        {
            "email": email,
            "password_hash": hashed,
            "name": input.name,
            "role": input.role,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"id": str(result.inserted_id), "email": email, "name": input.name, "role": input.role}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    db = get_db()
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(refresh_token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access_token = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie("access_token", access_token, **cookie_kwargs(36000))
        return {"message": "Token refreshed"}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
