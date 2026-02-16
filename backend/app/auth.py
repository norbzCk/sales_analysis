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
from backend.models import User

TOKEN_TTL_SECONDS = 60 * 60 * 8
SECRET_KEY = os.getenv("APP_SECRET_KEY", "change-me-in-production")
security = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/auth", tags=["Auth"])


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
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return _get_user_by_id(db, int(user_id))


def require_roles(*allowed: str):
    allowed_set = set(allowed)

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_set:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return user

    return checker


@router.post("/login")
def login(payload: dict, db: Session = Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token({"sub": user.id, "role": user.role, "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


@router.get("/me")
def me(current: User = Depends(get_current_user)):
    return {
        "id": current.id,
        "name": current.name,
        "email": current.email,
        "role": current.role,
        "is_active": current.is_active,
    }


@router.post("/users")
def create_user(
    payload: dict,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin")),
):
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    role = (payload.get("role") or "user").strip()
    if role not in {"user", "admin", "super_admin"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    if role == "super_admin" and current.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super_admin can create super_admin")
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
    _: User = Depends(require_roles("admin", "super_admin")),
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
