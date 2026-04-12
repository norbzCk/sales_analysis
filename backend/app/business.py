import secrets
from datetime import datetime, timedelta, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import (
    BusinessUser,
    BusinessMetrics,
    BusinessVerification,
    Product,
    Sale,
    DeliveryOrder,
    LogisticsUser,
)
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
        "operating_hours": user.operating_hours,
        "shop_logo_url": user.shop_logo_url,
        "shop_images": user.shop_images,
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
        operating_hours=payload.operating_hours,
        shop_logo_url=payload.shop_logo_url,
        shop_images=payload.shop_images,
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
    if payload.business_type:
        user.business_type = payload.business_type.strip()
    if payload.email is not None:
        user.email = payload.email.strip() if payload.email else None
    if payload.phone is not None:
        next_phone = payload.phone.strip() if payload.phone else None
        if next_phone and next_phone != user.phone:
            existing = db.query(BusinessUser).filter(BusinessUser.phone == next_phone, BusinessUser.id != user.id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Phone number already in use")
        if next_phone:
            user.phone = next_phone
    if payload.category is not None:
        user.category = payload.category
    if payload.description is not None:
        user.description = payload.description
    if payload.region is not None:
        user.region = payload.region
    if payload.area is not None:
        user.area = payload.area
    if payload.street is not None:
        user.street = payload.street
    if payload.shop_number is not None:
        user.shop_number = payload.shop_number
    if payload.operating_hours is not None:
        user.operating_hours = payload.operating_hours
    if payload.shop_logo_url is not None:
        user.shop_logo_url = payload.shop_logo_url
    if payload.shop_images is not None:
        user.shop_images = payload.shop_images
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


def _seller_products_query(db: Session, user: BusinessUser):
    return db.query(Product).filter(Product.seller_id == user.id)


def _seller_sales_query(db: Session, user: BusinessUser):
    # Keep compatibility with older records where seller_id was not populated yet.
    return db.query(Sale).filter(
        or_(Sale.seller_id == user.id, Sale.provider_name == user.business_name)
    )


def _serialize_seller_order(order: Sale) -> dict:
    return {
        "id": order.id,
        "order_date": order.date.isoformat() if order.date else None,
        "product": order.product,
        "category": order.category,
        "quantity": order.quantity,
        "unit_price": float(order.unit_price or 0),
        "total": float((order.quantity or 0) * (order.unit_price or 0)),
        "status": order.status or "Pending",
        "status_reason": order.status_reason,
        "customer_id": order.created_by,
        "delivery_address": order.delivery_address,
        "delivery_phone": order.delivery_phone,
        "delivery_notes": order.delivery_notes,
        "delivery_method": order.delivery_method or "Standard",
        "product_id": order.product_id,
    }


def _ensure_order_owner(order: Sale, user: BusinessUser):
    if order.seller_id == user.id:
        return
    if (order.provider_name or "").strip().lower() == (user.business_name or "").strip().lower():
        return
    raise HTTPException(status_code=403, detail="Order does not belong to this business account")


def _inventory_overview(db: Session, user: BusinessUser) -> dict:
    products = _seller_products_query(db, user).all()
    total_products = len(products)
    total_value = 0.0
    out_of_stock = 0
    low_stock = 0
    alerts = []

    for product in products:
        stock = int(product.stock or 0)
        total_value += float(stock * float(product.price or 0))
        if stock == 0:
            out_of_stock += 1
        elif stock < 5:
            low_stock += 1
            alerts.append(
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "current_stock": stock,
                    "low_stock_threshold": 5,
                }
            )

    return {
        "total_products": total_products,
        "total_value": round(total_value, 2),
        "out_of_stock": out_of_stock,
        "low_stock": low_stock,
        "alerts": alerts[:12],
    }


@router.get("/dashboard/overview")
def business_dashboard_overview(
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    sales_query = _seller_sales_query(db, user)
    all_sales = sales_query.all()
    today_sales = [item for item in all_sales if item.date == today]
    week_sales = [item for item in all_sales if item.date and item.date >= week_start]
    month_sales = [item for item in all_sales if item.date and item.date >= month_start]

    def revenue(rows: list[Sale]) -> float:
        return round(sum(float((row.quantity or 0) * (row.unit_price or 0)) for row in rows), 2)

    pending_orders = [item for item in all_sales if (item.status or "Pending") in {"Pending", "Confirmed", "Packed"}]
    completed_orders = [item for item in all_sales if (item.status or "") in {"Received", "Delivered"}]
    cancelled_orders = [item for item in all_sales if (item.status or "") == "Cancelled"]

    top_products = (
        db.query(
            Sale.product,
            func.sum(Sale.quantity).label("units"),
            func.sum(Sale.quantity * Sale.unit_price).label("revenue"),
        )
        .filter(or_(Sale.seller_id == user.id, Sale.provider_name == user.business_name))
        .group_by(Sale.product)
        .order_by(func.sum(Sale.quantity).desc())
        .limit(5)
        .all()
    )

    deliveries_query = db.query(DeliveryOrder).filter(DeliveryOrder.seller_id == user.id)
    ongoing_deliveries = deliveries_query.filter(DeliveryOrder.status.in_(["assigned", "picked_up", "in_transit"])).count()
    completed_deliveries = deliveries_query.filter(DeliveryOrder.status == "delivered").count()

    inventory = _inventory_overview(db, user)
    return {
        "business": _serialize_business(user),
        "summary": {
            "revenue_today": revenue(today_sales),
            "revenue_week": revenue(week_sales),
            "revenue_month": revenue(month_sales),
            "revenue_total": revenue(all_sales),
            "orders_total": len(all_sales),
            "orders_pending": len(pending_orders),
            "orders_completed": len(completed_orders),
            "orders_cancelled": len(cancelled_orders),
            "ongoing_deliveries": ongoing_deliveries,
            "completed_deliveries": completed_deliveries,
            "inventory_low_stock": inventory["low_stock"],
            "inventory_out_of_stock": inventory["out_of_stock"],
        },
        "top_products": [
            {
                "product": row[0] or "-",
                "units": int(row[1] or 0),
                "revenue": float(row[2] or 0),
            }
            for row in top_products
        ],
        "inventory": inventory,
    }


@router.get("/inventory/overview")
def business_inventory_overview(
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    return _inventory_overview(db, user)


@router.get("/analytics")
def business_analytics(
    range_days: int = 30,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    days = max(7, min(180, int(range_days or 30)))
    start_date = date.today() - timedelta(days=days - 1)

    rows = (
        _seller_sales_query(db, user)
        .filter(Sale.date >= start_date)
        .with_entities(Sale.date, func.sum(Sale.quantity * Sale.unit_price))
        .group_by(Sale.date)
        .order_by(Sale.date.asc())
        .all()
    )
    revenue_timeline = [{"date": row[0].isoformat(), "revenue": float(row[1] or 0)} for row in rows if row[0]]

    demand_rows = (
        _seller_sales_query(db, user)
        .filter(Sale.date >= start_date)
        .with_entities(Sale.category, func.sum(Sale.quantity))
        .group_by(Sale.category)
        .order_by(func.sum(Sale.quantity).desc())
        .all()
    )
    demand = [{"category": row[0] or "Uncategorized", "units": int(row[1] or 0)} for row in demand_rows]

    return {
        "range_days": days,
        "revenue_timeline": revenue_timeline,
        "demand_by_category": demand,
    }


@router.get("/orders")
def get_business_orders(
    status: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    query = _seller_sales_query(db, user)
    if status:
        query = query.filter(Sale.status == status)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(Sale.product.ilike(term), Sale.category.ilike(term), Sale.delivery_address.ilike(term)))
    orders = query.order_by(Sale.date.desc(), Sale.id.desc()).limit(250).all()
    return {"items": [_serialize_seller_order(order) for order in orders]}


@router.patch("/orders/{order_id}/decision")
def business_order_decision(
    order_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    order = db.query(Sale).filter(Sale.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    _ensure_order_owner(order, user)

    decision = (payload.get("decision") or "").strip().lower()
    reason = (payload.get("reason") or "").strip() or None
    if decision not in {"accept", "reject"}:
        raise HTTPException(status_code=400, detail="decision must be accept or reject")

    if decision == "accept":
        order.status = "Confirmed"
        order.status_reason = reason
    else:
        order.status = "Cancelled"
        order.status_reason = reason or "Rejected by seller"
        if order.product_id:
            product = db.query(Product).filter(Product.id == order.product_id).first()
            if product:
                product.stock = int(product.stock or 0) + int(order.quantity or 0)
                db.add(product)

    db.add(order)
    db.commit()
    db.refresh(order)
    return {"message": "Order decision recorded", "order": _serialize_seller_order(order)}


@router.patch("/orders/{order_id}/status")
def business_update_order_status(
    order_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    order = db.query(Sale).filter(Sale.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    _ensure_order_owner(order, user)

    target = (payload.get("status") or "").strip().title()
    reason = (payload.get("reason") or "").strip() or None
    valid = {
        "Pending": {"Confirmed", "Cancelled"},
        "Confirmed": {"Packed", "Cancelled"},
        "Packed": {"Ready For Shipping", "Cancelled"},
        "Ready For Shipping": {"Shipped", "Cancelled"},
        "Shipped": set(),
        "Received": set(),
        "Cancelled": set(),
    }
    current = (order.status or "Pending").strip().title()
    if target not in valid.get(current, set()):
        raise HTTPException(status_code=400, detail=f"Cannot move order from {current} to {target}")

    order.status = target
    order.status_reason = reason
    if target == "Cancelled" and order.product_id:
        product = db.query(Product).filter(Product.id == order.product_id).first()
        if product:
            product.stock = int(product.stock or 0) + int(order.quantity or 0)
            db.add(product)
    db.add(order)
    db.commit()
    db.refresh(order)
    return {"message": "Order status updated", "order": _serialize_seller_order(order)}


@router.post("/orders/{order_id}/assign-delivery")
def business_assign_delivery(
    order_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    order = db.query(Sale).filter(Sale.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    _ensure_order_owner(order, user)

    logistics_id = payload.get("logistics_id")
    if logistics_id:
        logistics = db.query(LogisticsUser).filter(LogisticsUser.id == int(logistics_id), LogisticsUser.is_active == True).first()
    else:
        logistics = (
            db.query(LogisticsUser)
            .filter(
                LogisticsUser.is_active == True,
                LogisticsUser.status == "online",
                LogisticsUser.availability == "available",
            )
            .order_by(LogisticsUser.id.asc())
            .first()
        )
    if not logistics:
        raise HTTPException(status_code=404, detail="No logistics partner available")

    delivery = db.query(DeliveryOrder).filter(DeliveryOrder.order_id == order.id).first()
    if not delivery:
        delivery = DeliveryOrder(
            order_id=order.id,
            seller_id=user.id,
            buyer_id=order.created_by,
            logistics_id=logistics.id,
            pickup_location=payload.get("pickup_location") or f"{user.area or ''} {user.street or ''}".strip() or "Seller location",
            delivery_location=payload.get("delivery_location") or order.delivery_address,
            pickup_phone=payload.get("pickup_phone") or user.phone,
            delivery_phone=payload.get("delivery_phone") or order.delivery_phone,
            status="assigned",
            price=float(payload.get("price") or 0) or None,
            special_instructions=(payload.get("special_instructions") or "").strip() or None,
            verification_code=secrets.token_hex(4).upper(),
        )
        db.add(delivery)
    else:
        delivery.logistics_id = logistics.id
        delivery.status = "assigned"
        delivery.special_instructions = (payload.get("special_instructions") or delivery.special_instructions or "").strip() or None
        if payload.get("delivery_location"):
            delivery.delivery_location = payload.get("delivery_location")
        if payload.get("price") is not None:
            delivery.price = float(payload.get("price") or 0) or None

    order.status = "Ready For Shipping"
    logistics.availability = "busy"

    db.add(order)
    db.add(logistics)
    db.commit()
    db.refresh(delivery)
    return {
        "message": "Delivery assigned",
        "delivery": {
            "id": delivery.id,
            "order_id": delivery.order_id,
            "logistics_id": delivery.logistics_id,
            "status": delivery.status,
            "verification_code": delivery.verification_code,
        },
    }


@router.get("/deliveries")
def business_deliveries(
    status: str | None = None,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    query = db.query(DeliveryOrder).filter(DeliveryOrder.seller_id == user.id)
    if status:
        query = query.filter(DeliveryOrder.status == status)
    items = query.order_by(DeliveryOrder.created_at.desc()).limit(200).all()
    return {
        "items": [
            {
                "id": item.id,
                "order_id": item.order_id,
                "seller_id": item.seller_id,
                "buyer_id": item.buyer_id,
                "logistics_id": item.logistics_id,
                "pickup_location": item.pickup_location,
                "delivery_location": item.delivery_location,
                "status": item.status,
                "price": item.price,
                "special_instructions": item.special_instructions,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "picked_at": item.picked_at.isoformat() if item.picked_at else None,
                "delivered_at": item.delivered_at.isoformat() if item.delivered_at else None,
            }
            for item in items
        ]
    }


@router.patch("/deliveries/{delivery_id}/instructions")
def business_update_delivery_instructions(
    delivery_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    delivery = db.query(DeliveryOrder).filter(DeliveryOrder.id == delivery_id, DeliveryOrder.seller_id == user.id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    delivery.special_instructions = (payload.get("special_instructions") or "").strip() or None
    if payload.get("delivery_location"):
        delivery.delivery_location = payload.get("delivery_location")
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return {"message": "Delivery instructions updated"}


@router.get("/notifications")
def business_notifications(
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    low_stock = _inventory_overview(db, user)["alerts"][:5]
    pending_orders = (
        _seller_sales_query(db, user)
        .filter(Sale.status.in_(["Pending", "Confirmed"]))
        .order_by(Sale.date.desc(), Sale.id.desc())
        .limit(8)
        .all()
    )
    in_transit = (
        db.query(DeliveryOrder)
        .filter(DeliveryOrder.seller_id == user.id, DeliveryOrder.status.in_(["assigned", "picked_up", "in_transit"]))
        .order_by(DeliveryOrder.created_at.desc())
        .limit(8)
        .all()
    )

    alerts = []
    for item in pending_orders:
        alerts.append(
            {
                "type": "order",
                "title": f"Order #{item.id} needs attention",
                "message": f"{item.product} x{item.quantity} is currently {item.status or 'Pending'}",
                "created_at": item.date.isoformat() if item.date else None,
            }
        )
    for item in in_transit:
        alerts.append(
            {
                "type": "delivery",
                "title": f"Delivery #{item.id} in progress",
                "message": f"Status: {item.status}. Destination: {item.delivery_location or '-'}",
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
        )
    for item in low_stock:
        alerts.append(
            {
                "type": "inventory",
                "title": f"Low stock: {item['product_name']}",
                "message": f"Only {item['current_stock']} units left",
                "created_at": None,
            }
        )
    return {"items": alerts[:20]}


@router.post("/products/bulk")
def business_bulk_create_products(
    payload: dict,
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    items = payload.get("items") or []
    if not isinstance(items, list) or not items:
        raise HTTPException(status_code=400, detail="items must be a non-empty list")

    created = []
    skipped = []
    for idx, item in enumerate(items):
        name = str(item.get("name") or "").strip()
        category = str(item.get("category") or "").strip()
        description = str(item.get("description") or "").strip()
        try:
            price = float(item.get("price") or 0)
            stock = int(item.get("stock") or 0)
        except (TypeError, ValueError):
            skipped.append({"index": idx, "reason": "price/stock must be numeric"})
            continue

        if not name or not category or price <= 0 or stock < 0:
            skipped.append({"index": idx, "reason": "invalid required fields"})
            continue

        product = Product(
            name=name,
            category=category,
            price=price,
            stock=stock,
            description=description,
            image_url=str(item.get("image_url") or "").strip() or None,
            seller_id=user.id,
            is_active=True,
        )
        db.add(product)
        created.append(product)

    db.commit()
    return {
        "message": "Bulk product upload completed",
        "created_count": len(created),
        "skipped": skipped,
    }


@router.get("/communication/feed")
def business_communication_feed(
    db: Session = Depends(get_db),
    auth: Optional[str] = Header(None, alias="Authorization"),
):
    user = get_current_business_user(db, auth)
    orders = _seller_sales_query(db, user).order_by(Sale.id.desc()).limit(30).all()
    threads = []
    for order in orders:
        threads.append(
            {
                "thread_id": f"order-{order.id}",
                "order_id": order.id,
                "customer_id": order.created_by,
                "subject": f"Order #{order.id} - {order.product}",
                "latest_message": f"Current status: {order.status or 'Pending'}",
                "delivery_address": order.delivery_address,
            }
        )
    return {"items": threads}


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
        "operating_hours": user.operating_hours,
        "shop_logo_url": user.shop_logo_url,
        "shop_images": user.shop_images,
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
