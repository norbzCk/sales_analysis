import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.app.notification_service import build_login_email, build_password_reset_email, create_notification, resolve_subject
from backend.models import User, BusinessUser, LogisticsUser

TOKEN_TTL_SECONDS = 60 * 60 * 8
PASSWORD_RESET_TTL_SECONDS = 60 * 30
SECRET_KEY = os.getenv("APP_SECRET_KEY", "change-me-in-production")
SUPERADMIN_EMAIL = os.getenv("SUPERADMIN_EMAIL", "superadmin@gmail.com").strip().lower()
SUPERADMIN_PASSWORD = os.getenv("SUPERADMIN_PASSWORD", "adminkey")
security = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/auth", tags=["Auth"])
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


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


def _build_superadmin_user() -> User:
    return User(
        id=0,
        name="Super Admin",
        email=SUPERADMIN_EMAIL,
        phone=None,
        address=None,
        role="super_admin",
        is_active=True,
    )


def _normalize_identifier(value: str | None) -> str:
    return (value or "").strip()


def _normalize_email(value: str | None) -> str:
    return _normalize_identifier(value).lower()


def _superadmin_matches(email: str | None, password: str | None) -> bool:
    return _normalize_email(email) == SUPERADMIN_EMAIL and (password or "") == SUPERADMIN_PASSWORD


def _find_recovery_account(db: Session, identifier: str):
    lookup = _normalize_identifier(identifier)
    if not lookup:
        return None, None

    lowered = lookup.lower()
    user = db.query(User).filter(or_(func.lower(User.email) == lowered, User.phone == lookup)).first()
    if user and user.is_active:
        user.role = _normalize_role(user.role)
        return "user", user

    business = db.query(BusinessUser).filter(or_(func.lower(BusinessUser.email) == lowered, BusinessUser.phone == lookup)).first()
    if business and business.is_active:
        business.role = _normalize_role(business.role)
        return "business", business

    logistics = db.query(LogisticsUser).filter(or_(func.lower(LogisticsUser.email) == lowered, LogisticsUser.phone == lookup)).first()
    if logistics and logistics.is_active:
        logistics.role = "logistics"
        return "logistics", logistics

    return None, None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User | BusinessUser | LogisticsUser:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if payload.get("user_type") == "superadmin" or (
        _normalize_role(payload.get("role")) == "super_admin" and str(payload.get("sub", "")) == "0"
    ):
        return _build_superadmin_user()
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
    if user_type == "logistics":
        user_id = payload.get("user_id") or payload.get("sub")
        logistics = None
        if user_id is not None:
            try:
                logistics = db.query(LogisticsUser).filter(LogisticsUser.id == int(user_id)).first()
            except (TypeError, ValueError):
                logistics = None
        if not logistics:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not logistics.is_active:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        logistics.role = "logistics"
        return logistics
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


@router.post("/password-recovery/request")
def request_password_recovery(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    identifier = (payload.get("identifier") or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Please enter your email or phone number")

    account_type, account = _find_recovery_account(db, identifier)
    response = {
        "message": "If an account matches the provided details, password recovery instructions are ready."
    }

    if account_type == "user":
        response["reset_token"] = create_token(
            {
                "purpose": "password_recovery",
                "account_type": "user",
                "user_id": account.id,
                "sub": account.id,
            },
            ttl_seconds=PASSWORD_RESET_TTL_SECONDS,
        )
    elif account_type == "business":
        response["reset_token"] = create_token(
            {
                "purpose": "password_recovery",
                "account_type": "business",
                "user_id": account.id,
                "sub": account.id,
            },
            ttl_seconds=PASSWORD_RESET_TTL_SECONDS,
        )
    elif account_type == "logistics":
        response["reset_token"] = create_token(
            {
                "purpose": "password_recovery",
                "account_type": "logistics",
                "user_id": account.id,
                "sub": account.id,
            },
            ttl_seconds=PASSWORD_RESET_TTL_SECONDS,
        )

    if account and response.get("reset_token"):
        recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(account)
        reset_subject, reset_body = build_password_reset_email(recipient_name, response["reset_token"])
        create_notification(
            db,
            recipient_type=recipient_type,
            recipient_id=recipient_id,
            recipient_email=recipient_email,
            title="Password reset requested",
            message="Password reset instructions are ready for your account.",
            notification_type="security",
            severity="warning",
            action_href="/forgot-password",
            metadata={"purpose": "password_recovery"},
            send_email=bool(recipient_email),
            email_subject=reset_subject,
            email_body=reset_body,
            background_tasks=background_tasks,
        )
        db.commit()

    return response


@router.post("/password-recovery/reset")
def reset_password_recovery(payload: dict, db: Session = Depends(get_db)):
    token = (payload.get("token") or "").strip()
    new_password = payload.get("new_password") or ""

    if not token:
        raise HTTPException(status_code=400, detail="Reset token is required")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    try:
        decoded = decode_token(token)
    except HTTPException:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    if decoded.get("purpose") != "password_recovery":
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    account_type = decoded.get("account_type")
    account_id = decoded.get("user_id") or decoded.get("sub")

    try:
        account_id = int(account_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    if account_type == "business":
        account = db.query(BusinessUser).filter(BusinessUser.id == account_id).first()
    elif account_type == "logistics":
        account = db.query(LogisticsUser).filter(LogisticsUser.id == account_id).first()
    else:
        account = db.query(User).filter(User.id == account_id).first()

    if not account or not account.is_active:
        raise HTTPException(status_code=400, detail="We could not reset the password for this account")

    account.password_hash = hash_password(new_password)
    db.add(account)
    db.commit()
    return {"message": "Password reset successful. You can now sign in with your new password."}


@router.post("/register")
def register(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
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
        profile_photo=(payload.get("profile_photo") or "").strip() or None,
        password_hash=hash_password(password),
        role="user",
        is_active=True,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(model)
    create_notification(
        db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        recipient_email=recipient_email,
        title="Welcome to SokoLnk",
        message="Your customer account is ready. You can now browse products, place orders, and track payments.",
        notification_type="system",
        severity="success",
        action_href="/app/customer",
        send_email=bool(recipient_email),
        email_subject="Welcome to SokoLnk",
        email_body=f"Hello {recipient_name},\n\nWelcome to SokoLnk. Your account is ready to use.\n\nSokoLnk Team",
        background_tasks=background_tasks,
    )
    db.commit()

    return {
        "id": model.id,
        "name": model.name,
        "email": model.email,
        "phone": model.phone,
        "address": model.address,
        "profile_photo": model.profile_photo,
        "role": model.role,
        "is_active": model.is_active,
    }


@router.post("/register-customer")
def register_customer(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
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
        profile_photo=(payload.get("profile_photo") or "").strip() or None,
        password_hash=hash_password(password),
        role="user",
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(model)
    create_notification(
        db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        recipient_email=recipient_email,
        title="Welcome to SokoLnk",
        message="Your buyer account has been created successfully.",
        notification_type="system",
        severity="success",
        action_href="/app/customer",
        send_email=bool(recipient_email),
        email_subject="Welcome to SokoLnk",
        email_body=f"Hello {recipient_name},\n\nYour buyer account is ready.\n\nSokoLnk Team",
        background_tasks=background_tasks,
    )
    db.commit()
    
    token = create_token({"sub": model.id, "role": "user", "email": model.email})
    return {
        "token": token,
        "user": {
            "id": model.id,
            "name": model.name,
            "email": model.email,
            "phone": model.phone,
            "address": model.address,
            "profile_photo": model.profile_photo,
            "role": "user",
        }
    }


@router.post("/login")
def login(
    payload: dict,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
):
    email = _normalize_email(payload.get("email"))
    phone = _normalize_identifier(payload.get("phone"))
    password = payload.get("password") or ""
    
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")

    if _superadmin_matches(email, password):
        temp_user = _build_superadmin_user()
        recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(temp_user)
        subject, body = build_login_email(
            recipient_name,
            "super admin",
            request.client.host if request.client else None,
            request.headers.get("user-agent"),
        )
        create_notification(
            db,
            recipient_type=recipient_type,
            recipient_id=recipient_id,
            recipient_email=recipient_email,
            title="Superadmin login detected",
            message="A superadmin session was opened successfully.",
            notification_type="security",
            severity="warning",
            action_href="/app/superadmin",
            send_email=bool(recipient_email),
            email_subject=subject,
            email_body=body,
            background_tasks=background_tasks,
        )
        db.commit()
        token = create_token(
            {
                "sub": 0,
                "role": "super_admin",
                "email": SUPERADMIN_EMAIL,
                "user_type": "superadmin",
            }
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": 0,
                "name": "Super Admin",
                "email": SUPERADMIN_EMAIL,
                "role": "super_admin",
                "is_active": True,
            },
        }
    
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
    recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(user)
    subject, body = build_login_email(
        recipient_name,
        role or "user",
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )
    create_notification(
        db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        recipient_email=recipient_email,
        title="Login detected on your account",
        message=f"A new login was recorded for your {role} account.",
        notification_type="security",
        severity="info",
        action_href="/app/profile",
        send_email=bool(recipient_email),
        email_subject=subject,
        email_body=body,
        background_tasks=background_tasks,
    )
    db.commit()

    token = create_token({"sub": user.id, "role": role, "email": user.email, "phone": user.phone})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "address": user.address,
            "profile_photo": getattr(user, "profile_photo", None),
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
        "profile_photo": getattr(current, "profile_photo", None),
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
    profile_photo = (payload.get("profile_photo") or "").strip() or None
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")

    current.name = name
    current.phone = phone
    current.address = address
    current.profile_photo = profile_photo
    db.add(current)
    db.commit()
    db.refresh(current)
    return {
        "id": current.id,
        "name": current.name,
        "email": current.email,
        "phone": current.phone,
        "address": current.address,
        "profile_photo": getattr(current, "profile_photo", None),
        "role": current.role,
        "is_active": current.is_active,
    }


@router.post("/upload-profile-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    current: User = Depends(get_current_user),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXT:
        raise HTTPException(status_code=400, detail="Unsupported image format")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    filename = f"profile-{current.id}-{uuid.uuid4().hex}{suffix}"
    destination = uploads_dir / filename

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")

    destination.write_bytes(content)
    return {"image_url": f"/uploads/{filename}"}


@router.post("/change-password")
def change_password(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.id == 0 and current.role == "super_admin":
        raise HTTPException(status_code=400, detail="Superadmin password is managed separately")
    current_password = payload.get("current_password") or ""
    new_password = payload.get("new_password") or ""
    if not verify_password(current_password, current.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    current.password_hash = hash_password(new_password)
    db.add(current)
    recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(current)
    create_notification(
        db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        recipient_email=recipient_email,
        title="Password changed successfully",
        message="Your account password was changed successfully.",
        notification_type="security",
        severity="success",
        action_href="/app/profile",
        send_email=bool(recipient_email),
        email_subject="SokoLnk password changed",
        email_body=f"Hello {recipient_name},\n\nYour password was changed successfully.\n\nSokoLnk Security",
        background_tasks=background_tasks,
    )
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
