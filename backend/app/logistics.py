import secrets
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import LogisticsUser, LogisticsMetrics, DeliveryOrder
from backend.app.schemas import (
    LogisticsRegister, LogisticsLogin, LogisticsProfile,
    DeliveryOrderCreate, DeliveryOrderResponse, DeliveryStatusUpdate
)
from backend.app.auth import hash_password, verify_password, create_token, decode_token
from backend.app.business import get_current_business_user

router = APIRouter(prefix="/logistics", tags=["Logistics"])


def _serialize_logistics(user: LogisticsUser, include_email: bool = True) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "email": user.email if include_email else None,
        "account_type": user.account_type,
        "vehicle_type": user.vehicle_type,
        "plate_number": user.plate_number,
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
        return db.query(LogisticsUser).filter(LogisticsUser.email == email.lower()).first()
    return None


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
def register_logistics(payload: LogisticsRegister, db: Session = Depends(get_db)):
    existing = _get_logistics_user(db, payload.phone)
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    pw_hash = hash_password(payload.password)
    
    user = LogisticsUser(
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        email=(payload.email or "").strip() or None,
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
def login_logistics(payload: LogisticsLogin, db: Session = Depends(get_db)):
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
    elif payload.status == "delivered":
        delivery.delivered_at = datetime.utcnow()
        user.availability = "available"
        
        metrics = db.query(LogisticsMetrics).filter(LogisticsMetrics.logistics_id == user.id).first()
        if metrics:
            metrics.total_deliveries += 1
            metrics.success_rate = (metrics.total_deliveries / (metrics.total_deliveries + metrics.cancel_rate)) * 100
    
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
