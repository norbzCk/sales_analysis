import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, BusinessUser

TOKEN_TTL_SECONDS = 60 * 60 * 8
SECRET_KEY = os.getenv("APP_SECRET_KEY", "change-me-in-production")
security = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _normalize_role(value: str | None) -> str:
    role = (value or "").strip().lower()
    if role == "customer":
        return "user"
    return role


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return hmac.compare_digest(check, expected)


def _sign(payload: bytes) -> str:
    sig = hmac.new(SECRET_KEY.encode("utf-8"), payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode("utf-8").rstrip("=")


def create_token(data: dict, ttl_seconds: int = TOKEN_TTL_SECONDS) -> str:
    payload = dict(data)
    payload["exp"] = int(time.time()) + ttl_seconds
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")
    signature = _sign(raw)
    return f"{payload_b64}.{signature}"


def decode_token(token: str) -> dict:
    try:
        payload_b64, signature = token.split(".", 1)
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("utf-8"))
        expected_sig = _sign(raw)
        if not hmac.compare_digest(expected_sig, signature):
            raise HTTPException(status_code=401, detail="Invalid token")
        payload = json.loads(raw.decode("utf-8"))
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("exp", 0) < int(time.time()):
        raise HTTPException(status_code=401, detail="Token expired")
    return payload


def _get_user_by_id(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    user_type = payload.get("user_type")
    if user_type == "business":
        user_id = payload.get("user_id") or payload.get("sub")
        business = None
        if user_id is not None:
            try:
                business = db.query(BusinessUser).filter(BusinessUser.id == int(user_id)).first()
            except (TypeError, ValueError):
                business = None
        if not business:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not business.is_active:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        business.role = _normalize_role(business.role)
        return business
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = _get_user_by_id(db, int(user_id))
    user.role = _normalize_role(user.role)
    return user


def require_roles(*allowed: str):
    allowed_set = {_normalize_role(role) for role in allowed}

    def checker(user: User = Depends(get_current_user)) -> User:
        role = _normalize_role(user.role)
        user.role = role
        # Owner is the highest role and can perform super_admin/admin operations.
        if role == "owner" and ("super_admin" in allowed_set or "admin" in allowed_set):
            return user
        # Allow sellers to access admin-level endpoints where appropriate.
        if role == "seller" and "admin" in allowed_set:
            return user
        # super_admin can perform admin operations.
        if role == "super_admin" and "admin" in allowed_set:
            return user
        if role not in allowed_set:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return user

    return checker


@router.post("/register")
def register(payload: dict, db: Session = Depends(get_db)):
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    model = User(
        name=name,
        email=email,
        phone=(payload.get("phone") or "").strip() or None,
        address=(payload.get("address") or "").strip() or None,
        password_hash=hash_password(password),
        role="user",
        is_active=True,
    )
    db.add(model)
    db.commit()
    db.refresh(model)

    return {
        "id": model.id,
        "name": model.name,
        "email": model.email,
        "phone": model.phone,
        "address": model.address,
        "role": model.role,
        "is_active": model.is_active,
    }


@router.post("/register-customer")
def register_customer(payload: dict, db: Session = Depends(get_db)):
    name = (payload.get("name") or "").strip()
    phone = (payload.get("phone") or "").strip()
    email = (payload.get("email") or "").strip().lower() or None
    password = payload.get("password") or ""
    location = (payload.get("location") or "").strip() or None
    
    if not name or not phone or not password:
        raise HTTPException(status_code=400, detail="Name, phone and password are required")
    
    existing = db.query(User).filter(User.phone == phone).first()
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    model = User(
        name=name,
        email=email,
        phone=phone,
        address=location,
        password_hash=hash_password(password),
        role="user",
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    
    token = create_token({"sub": model.id, "role": "user", "email": model.email})
    return {
        "token": token,
        "user": {
            "id": model.id,
            "name": model.name,
            "email": model.email,
            "phone": model.phone,
            "address": model.address,
            "role": "user",
        }
    }


@router.post("/login")
def login(payload: dict, db: Session = Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip()
    password = payload.get("password") or ""
    
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
    
    # Support login by email OR phone
    user = None
    if email:
        user = db.query(User).filter(User.email == email).first()
    elif phone:
        user = db.query(User).filter(User.phone == phone).first()
    
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid phone or password")

    role = _normalize_role(user.role)
    user.role = role

    token = create_token({"sub": user.id, "role": role, "email": user.email, "phone": user.phone})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": role,
        },
    }


@router.get("/me")
def me(current: User = Depends(get_current_user)):
    return {
        "id": current.id,
        "name": current.name,
        "email": current.email,
        "phone": current.phone,
        "address": current.address,
        "role": current.role,
        "is_active": current.is_active,
    }


@router.put("/me")
def update_me(
    payload: dict,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    name = (payload.get("name") or current.name or "").strip()
    phone = (payload.get("phone") or "").strip() or None
    address = (payload.get("address") or "").strip() or None
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")

    current.name = name
    current.phone = phone
    current.address = address
    db.add(current)
    db.commit()
    db.refresh(current)
    return {
        "id": current.id,
        "name": current.name,
        "email": current.email,
        "phone": current.phone,
        "address": current.address,
        "role": current.role,
        "is_active": current.is_active,
    }


@router.post("/change-password")
def change_password(
    payload: dict,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    current_password = payload.get("current_password") or ""
    new_password = payload.get("new_password") or ""
    if not verify_password(current_password, current.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    current.password_hash = hash_password(new_password)
    db.add(current)
    db.commit()
    return {"message": "Password updated"}


@router.post("/users")
def create_user(
    payload: dict,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    role = _normalize_role(payload.get("role") or "user")
    if role not in {"user", "admin", "super_admin", "owner"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    if role in {"super_admin", "owner"} and current.role not in {"super_admin", "owner"}:
        raise HTTPException(status_code=403, detail="Only super_admin/owner can create super_admin or owner")
    if not name or not email or len(password) < 8:
        raise HTTPException(status_code=400, detail="Invalid user payload")
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    model = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return {
        "id": model.id,
        "name": model.name,
        "email": model.email,
        "role": model.role,
        "is_active": model.is_active,
    }


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    rows = db.query(User).order_by(User.id.asc()).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
        }
        for u in rows
    ]
