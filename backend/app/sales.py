from datetime import date, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import String, cast, func
from sqlalchemy.orm import Session

from backend.app.auth import get_current_user, require_roles
from backend.app.notification_service import create_notification, resolve_subject
from backend.database import get_db
from backend.models import BusinessUser, Product, Provider, Sale, User

router = APIRouter(tags=["Sales", "Orders"])

ORDER_STATUSES = {
    "Pending",
    "Confirmed",
    "Packed",
    "Ready For Shipping",
    "Shipped",
    "Received",
    "Cancelled",
}
ADMIN_TRANSITIONS = {
    "Pending": {"Confirmed", "Cancelled"},
    "Confirmed": {"Packed", "Cancelled"},
    "Packed": {"Ready For Shipping", "Cancelled"},
    "Ready For Shipping": {"Shipped", "Cancelled"},
    "Shipped": set(),
    "Received": set(),
    "Cancelled": set(),
}
CANCELLABLE_BY_CUSTOMER = {"Pending", "Confirmed"}
DELIVERY_METHODS = {"Standard", "Express", "Pickup"}


def _normalized_delivery_method(value: str | None) -> str:
    method = (value or "").strip().title()
    if method in DELIVERY_METHODS:
        return method
    return "Standard"


def _sales_query_for_current_user(db: Session, current: User):
    query = db.query(Sale)
    if current.role == "user":
        # Keep compatibility with legacy databases where created_by is varchar.
        query = query.filter(cast(Sale.created_by, String) == str(current.id))
    elif current.role == "seller":
        business_name = getattr(current, "business_name", None)
        query = query.filter(
            (Sale.seller_id == current.id) |
            ((Sale.seller_id.is_(None)) & (Sale.provider_name == business_name))
        )
    return query


def _normalized_status(raw_status: str | None) -> str:
    status = (raw_status or "").strip().title()
    if status == "Delivered":
        # Keep compatibility with old records.
        return "Received"
    if status in ORDER_STATUSES:
        return status
    return "Received"


def _requested_status(raw_status: str | None) -> str | None:
    status = (raw_status or "").strip().title()
    if status == "Delivered":
        return "Received"
    if status in ORDER_STATUSES:
        return status
    return None


def _serialize_order(s: Sale) -> dict:
    status = _normalized_status(s.status)
    return {
        "id": s.id,
        "order_date": s.date.isoformat() if s.date else None,
        "product": s.product,
        "category": s.category,
        "provider_id": s.provider_id,
        "provider_name": s.provider_name,
        "seller_id": s.seller_id,
        "quantity": s.quantity,
        "unit_price": s.unit_price,
        "total": (s.quantity or 0) * (s.unit_price or 0),
        "status": status,
        "status_reason": s.status_reason,
        "rating": s.rating,
        "created_by": s.created_by,
        "product_id": s.product_id,
        "delivery_address": s.delivery_address,
        "delivery_phone": s.delivery_phone,
        "delivery_notes": s.delivery_notes,
        "delivery_method": _normalized_delivery_method(s.delivery_method),
    }


def _apply_product_rating_stats(db: Session, product_id: int | None) -> None:
    if not product_id:
        return
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return

    avg_rating, rating_count = (
        db.query(func.avg(Sale.rating), func.count(Sale.id))
        .filter(
            Sale.product_id == product_id,
            Sale.status.in_(["Received", "Delivered"]),
            Sale.rating.isnot(None),
        )
        .first()
    )
    product.rating_avg = float(avg_rating or 0)
    product.rating_count = int(rating_count or 0)
    db.add(product)


def _ensure_owner_or_admin(order: Sale, current: User) -> None:
    if current.role == "user":
        if str(order.created_by) != str(current.id):
            raise HTTPException(status_code=403, detail="You can only access your own orders")
    elif current.role == "seller":
        business_name = getattr(current, "business_name", None)
        owns = str(order.seller_id or "") == str(current.id) or (
            order.seller_id is None and business_name and (order.provider_name or "") == business_name
        )
        if not owns:
            raise HTTPException(status_code=403, detail="You can only access your own sales orders")


def _find_buyer_and_seller(db: Session, order: Sale) -> tuple[User | None, BusinessUser | None]:
    buyer = None
    seller = None

    if order.created_by is not None:
        try:
            buyer = db.query(User).filter(User.id == int(order.created_by)).first()
        except (TypeError, ValueError):
            buyer = None

    if order.seller_id is not None:
        seller = db.query(BusinessUser).filter(BusinessUser.id == order.seller_id).first()
    elif order.provider_name:
        seller = db.query(BusinessUser).filter(BusinessUser.business_name == order.provider_name).first()

    return buyer, seller


def _notify_order_event(
    db: Session,
    background_tasks: BackgroundTasks,
    order: Sale,
    *,
    buyer_title: str,
    buyer_message: str,
    seller_title: str | None = None,
    seller_message: str | None = None,
    notification_type: str = "order",
    severity: str = "info",
) -> None:
    buyer, seller = _find_buyer_and_seller(db, order)
    if buyer:
        buyer_type, buyer_id, buyer_email, buyer_name = resolve_subject(buyer)
        create_notification(
            db,
            recipient_type=buyer_type,
            recipient_id=buyer_id,
            recipient_email=buyer_email,
            title=buyer_title,
            message=buyer_message,
            notification_type=notification_type,
            severity=severity,
            action_href="/app/orders",
            metadata={"order_id": order.id},
            background_tasks=background_tasks,
            send_email=bool(buyer_email),
            email_subject=buyer_title,
            email_body=f"Hello {buyer_name},\n\n{buyer_message}\n\nSokoLnk Orders",
        )

    if seller:
        seller_type, seller_id, seller_email, seller_name = resolve_subject(seller)
        create_notification(
            db,
            recipient_type=seller_type,
            recipient_id=seller_id,
            recipient_email=seller_email,
            title=seller_title or buyer_title,
            message=seller_message or buyer_message,
            notification_type=notification_type,
            severity=severity,
            action_href="/app/orders",
            metadata={"order_id": order.id},
            background_tasks=background_tasks,
            send_email=bool(seller_email),
            email_subject=seller_title or buyer_title,
            email_body=f"Hello {seller_name},\n\n{seller_message or buyer_message}\n\nSokoLnk Orders",
        )


@router.get("/sales/")
def get_sales(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("super_admin", "owner")),
):
    query = _sales_query_for_current_user(db, current)
    sales = query.order_by(Sale.date.desc(), Sale.id.desc()).all()
    return [
        {
            "id": s.id,
            "date": s.date.isoformat() if s.date else None,
            "product": s.product,
            "category": s.category,
            "quantity": s.quantity,
            "unit_price": s.unit_price,
            "revenue": (s.quantity or 0) * (s.unit_price or 0),
            "status": _normalized_status(s.status),
            "created_by": s.created_by,
        }
        for s in sales
    ]


@router.post("/sales/", status_code=201)
def create_sale(
    payload: dict,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("super_admin", "owner")),
):
    sale_date = payload.get("date")
    model = Sale(
        date=date.fromisoformat(sale_date) if sale_date else date.today(),
        product=payload.get("product"),
        category=payload.get("category"),
        quantity=int(payload.get("quantity", 0)),
        unit_price=float(payload.get("unit_price", 0)),
        status="Received",
        created_by=current.id,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return {
        "id": model.id,
        "date": model.date.isoformat() if model.date else None,
        "product": model.product,
        "category": model.category,
        "quantity": model.quantity,
        "unit_price": model.unit_price,
        "revenue": (model.quantity or 0) * (model.unit_price or 0),
        "status": model.status,
        "created_by": model.created_by,
    }


@router.get("/orders/")
def get_orders(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    query = _sales_query_for_current_user(db, current)
    sales = query.order_by(Sale.date.desc(), Sale.id.desc()).all()
    return [_serialize_order(s) for s in sales]


@router.post("/orders/", status_code=201)
def create_order(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("user")),
):
    sale_date = payload.get("order_date")
    product_id = payload.get("product_id")
    try:
        quantity = int(payload.get("quantity", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="quantity must be an integer")

    if not product_id:
        raise HTTPException(status_code=400, detail="product_id is required")
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    try:
        product_id = int(product_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="product_id must be an integer")

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if (product.stock or 0) < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock for this product")

    delivery_address = (payload.get("delivery_address") or current.address or "").strip() or None
    delivery_phone = (payload.get("delivery_phone") or current.phone or "").strip() or None
    delivery_notes = (payload.get("delivery_notes") or "").strip() or None
    delivery_method = _normalized_delivery_method(payload.get("delivery_method"))
    provider_name = None
    if getattr(product, "provider_id", None):
        provider = db.query(Provider).filter(Provider.id == product.provider_id).first()
        if provider:
            provider_name = provider.name
    if not provider_name and getattr(product, "seller_id", None):
        seller = db.query(BusinessUser).filter(BusinessUser.id == product.seller_id).first()
        if seller:
            provider_name = seller.business_name

    model = Sale(
        date=date.fromisoformat(sale_date) if sale_date else date.today(),
        product=product.name,
        category=product.category,
        product_id=product.id,
        seller_id=getattr(product, "seller_id", None),
        provider_id=getattr(product, "provider_id", None),
        provider_name=provider_name,
        quantity=quantity,
        unit_price=float(product.price or 0),
        status="Pending",
        created_by=current.id,
        delivery_address=delivery_address,
        delivery_phone=delivery_phone,
        delivery_notes=delivery_notes,
        delivery_method=delivery_method,
    )

    product.stock = int(product.stock or 0) - quantity
    db.add(model)
    _notify_order_event(
        db,
        background_tasks,
        model,
        buyer_title=f"Order #{model.id} created successfully",
        buyer_message=f"Your order for {model.product} has been placed and is awaiting seller confirmation.",
        seller_title=f"New order #{model.id} requires attention",
        seller_message=f"You received a new order for {model.product} x{model.quantity}.",
        severity="info",
    )
    db.commit()
    db.refresh(model)
    return _serialize_order(model)


@router.patch("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("seller", "admin", "super_admin", "owner")),
):
    target_status = _requested_status(payload.get("status"))
    if not target_status:
        raise HTTPException(status_code=400, detail="Invalid status")

    order = db.query(Sale).filter(Sale.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current.role == "seller":
        _ensure_owner_or_admin(order, current)

    current_status = _normalized_status(order.status)
    if target_status == current_status:
        return _serialize_order(order)

    if target_status not in ADMIN_TRANSITIONS.get(current_status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move order from {current_status} to {target_status}",
        )

    order.status = target_status
    order.status_reason = (payload.get("reason") or "").strip() or None
    if target_status == "Cancelled" and order.product_id:
        product = db.query(Product).filter(Product.id == order.product_id).first()
        if product:
            product.stock = int(product.stock or 0) + int(order.quantity or 0)
            db.add(product)

    db.add(order)
    _notify_order_event(
        db,
        background_tasks,
        order,
        buyer_title=f"Order #{order.id} moved to {target_status}",
        buyer_message=f"Your order for {order.product} is now {target_status}.",
        seller_title=f"Order #{order.id} updated",
        seller_message=f"Order #{order.id} is now {target_status}.",
        severity="warning" if target_status == "Cancelled" else "info",
    )
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.post("/orders/{order_id}/receive")
def confirm_received(
    order_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("user")),
):
    order = db.query(Sale).filter(Sale.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _ensure_owner_or_admin(order, current)
    current_status = _normalized_status(order.status)
    if current_status != "Shipped":
        raise HTTPException(status_code=400, detail="Only shipped orders can be marked received")

    order.status = "Received"
    db.add(order)
    _notify_order_event(
        db,
        background_tasks,
        order,
        buyer_title=f"Order #{order.id} marked as received",
        buyer_message=f"You confirmed receipt of {order.product}.",
        seller_title=f"Order #{order.id} received by customer",
        seller_message=f"The customer confirmed receipt of {order.product}.",
        severity="success",
    )
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.post("/orders/{order_id}/cancel")
def cancel_order(
    order_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("user")),
):
    order = db.query(Sale).filter(Sale.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _ensure_owner_or_admin(order, current)
    current_status = _normalized_status(order.status)
    if current_status not in CANCELLABLE_BY_CUSTOMER:
        raise HTTPException(status_code=400, detail="Order can no longer be cancelled")

    order.status = "Cancelled"
    if order.product_id:
        product = db.query(Product).filter(Product.id == order.product_id).first()
        if product:
            product.stock = int(product.stock or 0) + int(order.quantity or 0)
            db.add(product)

    db.add(order)
    _notify_order_event(
        db,
        background_tasks,
        order,
        buyer_title=f"Order #{order.id} cancelled",
        buyer_message=f"Your order for {order.product} has been cancelled.",
        seller_title=f"Order #{order.id} cancelled by customer",
        seller_message=f"The customer cancelled the order for {order.product}.",
        severity="warning",
    )
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.post("/orders/{order_id}/rating")
def rate_order(
    order_id: int,
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("user")),
):
    try:
        rating = int(payload.get("rating", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="rating must be an integer")

    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    order = db.query(Sale).filter(Sale.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _ensure_owner_or_admin(order, current)
    if _normalized_status(order.status) != "Received":
        raise HTTPException(status_code=400, detail="Only received orders can be rated")
    if order.rating is not None:
        raise HTTPException(status_code=400, detail="Order already rated")

    order.rating = rating
    order.rated_at = datetime.utcnow()
    db.add(order)

    _apply_product_rating_stats(db, order.product_id)
    _notify_order_event(
        db,
        background_tasks,
        order,
        buyer_title=f"Rating saved for order #{order.id}",
        buyer_message=f"Thanks for rating {order.product} {rating}/5.",
        seller_title=f"New rating for order #{order.id}",
        seller_message=f"Your order for {order.product} received a rating of {rating}/5.",
        notification_type="rating",
        severity="success",
    )

    db.commit()
    db.refresh(order)
    return _serialize_order(order)
