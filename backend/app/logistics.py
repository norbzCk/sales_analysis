import secrets
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Header, Request, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import LogisticsUser, LogisticsMetrics, DeliveryOrder, BusinessUser, Sale, User
from backend.app.schemas import (
    LogisticsRegister, LogisticsLogin, LogisticsProfile,
    DeliveryOrderCreate, DeliveryOrderResponse, DeliveryStatusUpdate
)
from backend.app.auth import hash_password, verify_password, create_token, decode_token
from backend.app.business import get_current_business_user
from backend.app.notification_service import build_login_email, create_notification, resolve_subject

router = APIRouter(prefix="/logistics", tags=["Logistics"])
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _serialize_logistics(user: LogisticsUser, include_email: bool = True) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "email": user.email if include_email else None,
        "role": "logistics",
        "account_type": user.account_type,
        "vehicle_type": user.vehicle_type,
        "plate_number": user.plate_number,
        "license_number": user.license_number,
        "base_area": user.base_area,
        "coverage_areas": user.coverage_areas,
        "status": user.status,
        "availability": user.availability,
        "profile_photo": user.profile_photo,
        "verification_status": user.verification_status,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _get_logistics_user(db: Session, phone: str = None, email: str = None):
    if phone:
        return db.query(LogisticsUser).filter(LogisticsUser.phone == phone).first()
    if email:
        return db.query(LogisticsUser).filter(func.lower(LogisticsUser.email) == email.lower()).first()
    return None


def _validate_new_password(current_password: str, new_password: str, password_hash: str):
    if not verify_password(current_password, password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")


def _notify_delivery_event(
    db: Session,
    background_tasks: BackgroundTasks,
    delivery: DeliveryOrder,
    *,
    title: str,
    message: str,
    buyer_message: str | None = None,
    seller_message: str | None = None,
    severity: str = "info",
):
    recipients: list[tuple[BusinessUser | User, str, str]] = []
    if delivery.seller_id:
        seller = db.query(BusinessUser).filter(BusinessUser.id == delivery.seller_id).first()
        if seller:
            recipients.append((seller, "/app/seller/deliveries", seller_message or message))
    if delivery.buyer_id:
        buyer = db.query(User).filter(User.id == delivery.buyer_id).first()
        if buyer:
            recipients.append((buyer, "/app/orders", buyer_message or message))

    for recipient, action_href, body_message in recipients:
        recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(recipient)
        create_notification(
            db,
            recipient_type=recipient_type,
            recipient_id=recipient_id,
            recipient_email=recipient_email,
            title=title,
            message=body_message,
            notification_type="delivery",
            severity=severity,
            action_href=action_href,
            metadata={"order_id": delivery.order_id, "delivery_id": delivery.id},
            send_email=bool(recipient_email),
            email_subject=title,
            email_body=f"Hello {recipient_name},\n\n{body_message}\n\nSokoLnk Delivery",
            background_tasks=background_tasks,
        )


def get_current_logistics_user(
    db: Session = Depends(get_db),
    auth_header: Optional[str] = Header(None, alias="Authorization"),
):
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    token = auth_header.replace("Bearer ", "")
    try:
        payload = decode_token(token)
        if payload.get("user_type") not in (None, "logistics"):
            raise HTTPException(status_code=403, detail="Not a logistics account")
        user_id = payload.get("user_id")
        sub = payload.get("sub")
        user = None
        if user_id:
            user = db.query(LogisticsUser).filter(LogisticsUser.id == int(user_id)).first()
        if not user and sub:
            if isinstance(sub, int) or (isinstance(sub, str) and sub.isdigit()):
                user = db.query(LogisticsUser).filter(LogisticsUser.id == int(sub)).first()
            else:
                user = _get_logistics_user(db, phone=str(sub))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/register")
def register_logistics(
    payload: LogisticsRegister,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    existing = _get_logistics_user(db, payload.phone)
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    pw_hash = hash_password(payload.password)
    
    user = LogisticsUser(
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        email=(payload.email or "").strip().lower() or None,
        password_hash=pw_hash,
        account_type=payload.account_type,
        vehicle_type=payload.vehicle_type,
        plate_number=payload.plate_number,
        license_number=payload.license_number,
        base_area=payload.base_area,
        coverage_areas=payload.coverage_areas,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    metrics = LogisticsMetrics(logistics_id=user.id)
    db.add(metrics)
    db.commit()
    recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(user)
    create_notification(
        db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        recipient_email=recipient_email,
        title="Welcome to SokoLnk delivery operations",
        message="Your logistics account is ready. Go online, accept deliveries, and manage order fulfillment.",
        notification_type="system",
        severity="success",
        action_href="/app/logistics",
        send_email=bool(recipient_email),
        email_subject="Welcome to SokoLnk delivery operations",
        email_body=f"Hello {recipient_name},\n\nYour logistics account has been created successfully.\n\nSokoLnk Team",
        background_tasks=background_tasks,
    )
    db.commit()
    
    token = create_token({
        "sub": user.id,
        "user_id": user.id,
        "phone": user.phone,
        "user_type": "logistics"
    })
    
    return {
        "message": "Logistics account created successfully",
        "token": token,
        "user": _serialize_logistics(user)
    }


@router.post("/login")
def login_logistics(
    payload: LogisticsLogin,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
):
    phone = (payload.phone or "").strip() or None
    email = (payload.email or "").strip().lower() or None
    
    if not phone and not email:
        raise HTTPException(status_code=400, detail="Phone or email is required")
    
    user = _get_logistics_user(db, phone=phone, email=email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(user)
    subject, body = build_login_email(
        recipient_name,
        "delivery",
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )
    create_notification(
        db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        recipient_email=recipient_email,
        title="Delivery login detected",
        message="A login was recorded on your logistics account.",
        notification_type="security",
        severity="info",
        action_href="/app/logistics",
        send_email=bool(recipient_email),
        email_subject=subject,
        email_body=body,
        background_tasks=background_tasks,
    )
    db.commit()
    
    token = create_token({
        "sub": user.id,
        "user_id": user.id,
        "phone": user.phone,
        "user_type": "logistics"
    })
    
    return {
        "message": "Login successful",
        "token": token,
        "user": _serialize_logistics(user)
    }


@router.get("/me")
def get_my_logistics_profile(
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization")
):
    user = get_current_logistics_user(db, auth)
    metrics = db.query(LogisticsMetrics).filter(LogisticsMetrics.logistics_id == user.id).first()
    
    data = _serialize_logistics(user)
    data["metrics"] = {
        "rating": metrics.rating if metrics else 0,
        "total_deliveries": metrics.total_deliveries if metrics else 0,
        "success_rate": metrics.success_rate if metrics else 0,
        "cancel_rate": metrics.cancel_rate if metrics else 0
    } if metrics else {"rating": 0, "total_deliveries": 0, "success_rate": 0, "cancel_rate": 0}
    
    return data


@router.put("/me")
def update_my_logistics_profile(
    payload: dict,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_logistics_user(db, auth)

    if payload.get("name") is not None:
        next_name = str(payload.get("name") or "").strip()
        if len(next_name) < 2:
            raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
        user.name = next_name

    if payload.get("email") is not None:
        next_email = str(payload.get("email") or "").strip().lower() or None
        if next_email and "@" not in next_email:
            raise HTTPException(status_code=400, detail="Invalid email")
        if next_email and next_email != (user.email or "").lower():
            existing = db.query(LogisticsUser).filter(func.lower(LogisticsUser.email) == next_email, LogisticsUser.id != user.id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
        user.email = next_email

    if payload.get("phone") is not None:
        next_phone = str(payload.get("phone") or "").strip()
        if not next_phone:
            raise HTTPException(status_code=400, detail="Phone is required")
        if next_phone != user.phone:
            existing = db.query(LogisticsUser).filter(LogisticsUser.phone == next_phone, LogisticsUser.id != user.id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Phone number already in use")
        user.phone = next_phone

    if payload.get("vehicle_type") is not None:
        user.vehicle_type = str(payload.get("vehicle_type") or "").strip() or None
    if payload.get("plate_number") is not None:
        user.plate_number = str(payload.get("plate_number") or "").strip() or None
    if payload.get("license_number") is not None:
        user.license_number = str(payload.get("license_number") or "").strip() or None
    if payload.get("base_area") is not None:
        user.base_area = str(payload.get("base_area") or "").strip() or None
    if payload.get("coverage_areas") is not None:
        user.coverage_areas = str(payload.get("coverage_areas") or "").strip() or None
    if payload.get("profile_photo") is not None:
        user.profile_photo = str(payload.get("profile_photo") or "").strip() or None

    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Logistics profile updated", "user": _serialize_logistics(user)}


@router.post("/upload-profile-photo")
async def upload_logistics_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_logistics_user(db, auth)
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXT:
        raise HTTPException(status_code=400, detail="Unsupported image format")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    filename = f"logistics-{user.id}-{uuid.uuid4().hex}{suffix}"
    destination = uploads_dir / filename

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")

    destination.write_bytes(content)
    return {"image_url": f"/uploads/{filename}"}


@router.post("/change-password")
def change_logistics_password(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization")
):
    user = get_current_logistics_user(db, auth)
    current_password = payload.get("current_password") or ""
    new_password = payload.get("new_password") or ""

    _validate_new_password(current_password, new_password, user.password_hash)

    user.password_hash = hash_password(new_password)
    db.add(user)
    recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(user)
    create_notification(
        db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        recipient_email=recipient_email,
        title="Logistics password changed",
        message="Your delivery account password was changed successfully.",
        notification_type="security",
        severity="success",
        action_href="/app/logistics",
        send_email=bool(recipient_email),
        email_subject="SokoLnk logistics password changed",
        email_body=f"Hello {recipient_name},\n\nYour delivery account password was changed successfully.\n\nSokoLnk Security",
        background_tasks=background_tasks,
    )
    db.commit()

    return {"message": "Password updated"}


@router.put("/status")
def update_status(
    payload: dict,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization")
):
    user = get_current_logistics_user(db, auth)
    
    status = (payload.get("status") or "").strip().lower()
    if status not in ["online", "offline"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    user.status = status
    if status == "offline":
        user.availability = "unavailable"
    
    db.commit()
    
    return {
        "message": f"Status updated to {status}",
        "status": user.status
    }


@router.put("/availability")
def update_availability(
    payload: dict,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization")
):
    user = get_current_logistics_user(db, auth)
    
    availability = (payload.get("availability") or "").strip().lower()
    if availability not in ["available", "busy"]:
        raise HTTPException(status_code=400, detail="Invalid availability")
    
    user.availability = availability
    db.commit()
    
    return {
        "message": f"Availability updated to {availability}",
        "availability": user.availability
    }


@router.post("/deliveries")
def create_delivery_order(
    payload: DeliveryOrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization")
):
    user = get_current_logistics_user(db, auth)
    
    verification_code = secrets.token_hex(4).upper()
    
    delivery = DeliveryOrder(
        order_id=payload.order_id,
        seller_id=payload.seller_id,
        buyer_id=payload.buyer_id,
        logistics_id=user.id,
        pickup_location=payload.pickup_location,
        delivery_location=payload.delivery_location,
        pickup_phone=payload.pickup_phone,
        delivery_phone=payload.delivery_phone,
        price=payload.price,
        status="assigned",
        verification_code=verification_code
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    
    user.availability = "busy"
    _notify_delivery_event(
        db,
        background_tasks,
        delivery,
        title=f"Delivery assigned for order #{delivery.order_id or delivery.id}",
        message=f"A logistics partner has been assigned. Pickup: {delivery.pickup_location or '-'}; destination: {delivery.delivery_location or '-'}.",
        severity="info",
    )
    db.commit()
    
    return {
        "message": "Delivery assigned",
        "delivery": {
            "id": delivery.id,
            "pickup_location": delivery.pickup_location,
            "delivery_location": delivery.delivery_location,
            "status": delivery.status,
            "verification_code": delivery.verification_code
        }
    }


@router.get("/deliveries")
def get_my_deliveries(
    status: str | None = None,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization")
):
    user = get_current_logistics_user(db, auth)
    
    query = db.query(DeliveryOrder).filter(DeliveryOrder.logistics_id == user.id)
    
    if status:
        query = query.filter(DeliveryOrder.status == status)
    
    deliveries = query.order_by(DeliveryOrder.created_at.desc()).limit(50).all()
    
    return {
        "deliveries": [
            {
                "id": d.id,
                "order_id": d.order_id,
                "pickup_location": d.pickup_location,
                "delivery_location": d.delivery_location,
                "status": d.status,
                "price": d.price,
                "verification_code": d.verification_code,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "picked_at": d.picked_at.isoformat() if d.picked_at else None,
                "delivered_at": d.delivered_at.isoformat() if d.delivered_at else None
            }
            for d in deliveries
        ]
    }


@router.put("/deliveries/{delivery_id}/status")
def update_delivery_status(
    delivery_id: int,
    payload: DeliveryStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization")
):
    user = get_current_logistics_user(db, auth)
    
    delivery = db.query(DeliveryOrder).filter(
        DeliveryOrder.id == delivery_id,
        DeliveryOrder.logistics_id == user.id
    ).first()
    
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    valid_transitions = {
        "assigned": "picked_up",
        "picked_up": "in_transit",
        "in_transit": "delivered"
    }
    
    if payload.status not in valid_transitions.values():
        raise HTTPException(status_code=400, detail="Invalid status")
    
    if payload.status == "delivered" and payload.verification_code:
        if payload.verification_code != delivery.verification_code:
            raise HTTPException(status_code=400, detail="Invalid verification code")
    
    delivery.status = payload.status
    
    if payload.status == "picked_up":
        delivery.picked_at = datetime.utcnow()
        order = db.query(Sale).filter(Sale.id == delivery.order_id).first() if delivery.order_id else None
        if order and (order.status or "").strip().title() not in {"Cancelled", "Received"}:
            order.status = "Shipped"
            db.add(order)
    elif payload.status == "in_transit":
        order = db.query(Sale).filter(Sale.id == delivery.order_id).first() if delivery.order_id else None
        if order and (order.status or "").strip().title() not in {"Cancelled", "Received"}:
            order.status = "Shipped"
            db.add(order)
    elif payload.status == "delivered":
        delivery.delivered_at = datetime.utcnow()
        user.availability = "available"
        order = db.query(Sale).filter(Sale.id == delivery.order_id).first() if delivery.order_id else None
        if order and (order.status or "").strip().title() != "Cancelled":
            order.status = "Received"
            order.status_reason = "Delivered by logistics partner"
            db.add(order)
        
        metrics = db.query(LogisticsMetrics).filter(LogisticsMetrics.logistics_id == user.id).first()
        if metrics:
            metrics.total_deliveries += 1
            metrics.success_rate = (metrics.total_deliveries / (metrics.total_deliveries + metrics.cancel_rate)) * 100

    _notify_delivery_event(
        db,
        background_tasks,
        delivery,
        title=f"Delivery update for order #{delivery.order_id or delivery.id}",
        message=f"The delivery status is now {delivery.status}.",
        buyer_message=(
            "Delivery completed successfully. Thank you for using SokoLnk."
            if payload.status == "delivered"
            else f"Your delivery is now {delivery.status}."
        ),
        seller_message=(
            "Delivery completed and order marked as delivered."
            if payload.status == "delivered"
            else f"Order delivery is now {delivery.status}."
        ),
        severity="success" if payload.status == "delivered" else "info",
    )
    
    db.commit()
    
    return {
        "message": f"Delivery status updated to {payload.status}",
        "delivery": {
            "id": delivery.id,
            "status": delivery.status,
            "delivered_at": delivery.delivered_at.isoformat() if delivery.delivered_at else None
        }
    }


@router.get("/available")
def get_available_logistics(
    area: str | None = None,
    vehicle_type: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(LogisticsUser).filter(
        LogisticsUser.is_active == True,
        LogisticsUser.status == "online",
        LogisticsUser.availability == "available",
        LogisticsUser.verification_status == "verified"
    )
    
    if area:
        query = query.filter(LogisticsUser.coverage_areas.ilike(f"%{area}%"))
    if vehicle_type:
        query = query.filter(LogisticsUser.vehicle_type == vehicle_type)
    
    logistics = query.order_by(LogisticsUser.id.desc()).limit(20).all()
    
    return {
        "items": [_serialize_logistics(l, include_email=False) for l in logistics]
    }


@router.get("/{logistics_id}")
def get_logistics_public_profile(
    logistics_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(LogisticsUser).filter(LogisticsUser.id == logistics_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Logistics provider not found")
    
    metrics = db.query(LogisticsMetrics).filter(LogisticsMetrics.logistics_id == logistics_id).first()
    
    return {
        "id": user.id,
        "name": user.name,
        "account_type": user.account_type,
        "vehicle_type": user.vehicle_type,
        "plate_number": user.plate_number,
        "base_area": user.base_area,
        "coverage_areas": user.coverage_areas,
        "verification_status": user.verification_status,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "metrics": {
            "rating": metrics.rating if metrics else 0,
            "total_deliveries": metrics.total_deliveries if metrics else 0,
            "success_rate": metrics.success_rate if metrics else 0
        } if metrics else {"rating": 0, "total_deliveries": 0, "success_rate": 0}
    }
