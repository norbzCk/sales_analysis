import secrets
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import BusinessUser, BusinessMetrics, BusinessVerification
from backend.app.schemas import (
    BusinessRegister, BusinessLogin, BusinessProfile, 
    BusinessUpdate, BusinessVerificationSubmit
)
from backend.app.auth import hash_password, verify_password, create_token, decode_token

router = APIRouter(prefix="/business", tags=["Business"])


def _serialize_business(user: BusinessUser, include_email: bool = True) -> dict:
    return {
        "id": user.id,
        "business_name": user.business_name,
        "owner_name": user.owner_name,
        "phone": user.phone,
        "email": user.email if include_email else None,
        "business_type": user.business_type,
        "category": user.category,
        "description": user.description,
        "region": user.region,
        "area": user.area,
        "street": user.street,
        "shop_number": user.shop_number,
        "profile_photo": user.profile_photo,
        "verification_status": user.verification_status,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _get_business_user(db: Session, phone: str = None, email: str = None):
    if phone:
        return db.query(BusinessUser).filter(BusinessUser.phone == phone).first()
    if email:
        return db.query(BusinessUser).filter(BusinessUser.email == email.lower()).first()
    return None


@router.post("/register")
def register_business(payload: BusinessRegister, db: Session = Depends(get_db)):
    existing = _get_business_user(db, payload.phone)
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    pw_hash = hash_password(payload.password)
    
    user = BusinessUser(
        business_name=payload.business_name.strip(),
        owner_name=payload.owner_name.strip(),
        phone=payload.phone.strip(),
        email=(payload.email or "").strip() or None,
        password_hash=pw_hash,
        business_type=payload.business_type,
        category=payload.category,
        description=payload.description,
        region=payload.region,
        area=payload.area,
        street=payload.street,
        shop_number=payload.shop_number,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    metrics = BusinessMetrics(business_id=user.id)
    db.add(metrics)
    db.commit()
    
    token = create_token({
        "sub": user.id,
        "user_id": user.id,
        "phone": user.phone,
        "role": user.role,
        "user_type": "business"
    })
    
    return {
        "message": "Business account created successfully",
        "token": token,
        "user": _serialize_business(user)
    }


@router.post("/login")
def login_business(payload: BusinessLogin, db: Session = Depends(get_db)):
    phone = (payload.phone or "").strip() or None
    email = (payload.email or "").strip().lower() or None
    
    if not phone and not email:
        raise HTTPException(status_code=400, detail="Phone or email is required")
    
    user = _get_business_user(db, phone=phone, email=email)
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
        "role": user.role,
        "user_type": "business"
    })
    
    return {
        "message": "Login successful",
        "token": token,
        "user": _serialize_business(user)
    }


def get_current_business_user(
    db: Session = Depends(get_db),
    auth_header: Optional[str] = Header(None, alias="Authorization"),
):
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = auth_header.replace("Bearer ", "")
    try:
        payload = decode_token(token)
        if payload.get("user_type") not in (None, "business"):
            raise HTTPException(status_code=403, detail="Not a business account")
        user_id = payload.get("user_id")
        sub = payload.get("sub")
        user = None
        if user_id:
            user = db.query(BusinessUser).filter(BusinessUser.id == int(user_id)).first()
        if not user and sub:
            if isinstance(sub, int) or (isinstance(sub, str) and sub.isdigit()):
                user = db.query(BusinessUser).filter(BusinessUser.id == int(sub)).first()
            else:
                user = _get_business_user(db, phone=str(sub))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/me")
def get_my_profile(
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization")
):
    user = get_current_business_user(db, auth)
    return _serialize_business(user)


@router.put("/me")
def update_my_profile(
    payload: BusinessUpdate,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization")
):
    user = get_current_business_user(db, auth)
    
    if payload.business_name:
        user.business_name = payload.business_name.strip()
    if payload.owner_name:
        user.owner_name = payload.owner_name.strip()
    if payload.email is not None:
        user.email = payload.email.strip() if payload.email else None
    if payload.category is not None:
        user.category = payload.category
    if payload.description is not None:
        user.description = payload.description
    if payload.area is not None:
        user.area = payload.area
    if payload.street is not None:
        user.street = payload.street
    if payload.shop_number is not None:
        user.shop_number = payload.shop_number
    if payload.profile_photo is not None:
        user.profile_photo = payload.profile_photo
    
    db.commit()
    db.refresh(user)
    
    return {
        "message": "Profile updated",
        "user": _serialize_business(user)
    }


@router.post("/verify")
def submit_verification(
    payload: BusinessVerificationSubmit,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization")
):
    user = get_current_business_user(db, auth)
    
    existing = db.query(BusinessVerification).filter(
        BusinessVerification.business_id == user.id,
        BusinessVerification.status == "pending"
    ).first()
    
    if existing:
        existing.document_type = payload.document_type
        existing.document_url = payload.document_url
    else:
        verification = BusinessVerification(
            business_id=user.id,
            document_type=payload.document_type,
            document_url=payload.document_url,
            status="pending"
        )
        db.add(verification)
    
    user.verification_status = "pending"
    db.commit()
    
    return {
        "message": "Verification documents submitted",
        "status": "pending"
    }


@router.get("/{business_id}")
def get_business_public_profile(
    business_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(BusinessUser).filter(BusinessUser.id == business_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Business not found")
    
    metrics = db.query(BusinessMetrics).filter(BusinessMetrics.business_id == business_id).first()
    
    return {
        "id": user.id,
        "business_name": user.business_name,
        "owner_name": user.owner_name,
        "business_type": user.business_type,
        "category": user.category,
        "description": user.description,
        "region": user.region,
        "area": user.area,
        "street": user.street,
        "shop_number": user.shop_number,
        "profile_photo": user.profile_photo,
        "verification_status": user.verification_status,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "metrics": {
            "rating": metrics.rating if metrics else 0,
            "total_sales": metrics.total_sales if metrics else 0,
            "reviews_count": metrics.reviews_count if metrics else 0
        } if metrics else {"rating": 0, "total_sales": 0, "reviews_count": 0}
    }


@router.get("/")
def list_businesses(
    category: str | None = None,
    area: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(BusinessUser).filter(BusinessUser.is_active == True, BusinessUser.role == "seller")
    
    if category:
        query = query.filter(BusinessUser.category == category)
    if area:
        query = query.filter(BusinessUser.area == area)
    
    total = query.count()
    businesses = query.offset(offset).limit(limit).all()
    
    return {
        "items": [_serialize_business(b, include_email=False) for b in businesses],
        "total": total,
        "limit": limit,
        "offset": offset
    }
