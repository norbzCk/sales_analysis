from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import String, cast, func
from sqlalchemy.orm import Session

from backend.app.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models import Product, Sale, User

router = APIRouter(tags=["Sales", "Orders"])

ORDER_STATUSES = {"Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"}
ADMIN_TRANSITIONS = {
    "Pending": {"Confirmed", "Cancelled"},
    "Confirmed": {"Shipped", "Cancelled"},
    "Shipped": {"Delivered"},
    "Delivered": set(),
    "Cancelled": set(),
}
CANCELLABLE_BY_CUSTOMER = {"Pending", "Confirmed"}


def _sales_query_for_current_user(db: Session, current: User):
    query = db.query(Sale)
    if current.role == "user":
        # Keep compatibility with legacy databases where created_by is varchar.
        query = query.filter(cast(Sale.created_by, String) == str(current.id))
    return query


def _normalized_status(raw_status: str | None) -> str:
    status = (raw_status or "").strip().title()
    if status in ORDER_STATUSES:
        return status
    return "Delivered"


def _requested_status(raw_status: str | None) -> str | None:
    status = (raw_status or "").strip().title()
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
        "quantity": s.quantity,
        "unit_price": s.unit_price,
        "total": (s.quantity or 0) * (s.unit_price or 0),
        "status": status,
        "rating": s.rating,
        "created_by": s.created_by,
        "product_id": s.product_id,
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
            Sale.status == "Delivered",
            Sale.rating.isnot(None),
        )
        .first()
    )
    product.rating_avg = float(avg_rating or 0)
    product.rating_count = int(rating_count or 0)
    db.add(product)


def _ensure_owner_or_admin(order: Sale, current: User) -> None:
    if current.role == "user" and str(order.created_by) != str(current.id):
        raise HTTPException(status_code=403, detail="You can only access your own orders")


@router.get("/sales/")
def get_sales(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("super_admin")),
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
    current: User = Depends(require_roles("super_admin")),
):
    sale_date = payload.get("date")
    model = Sale(
        date=date.fromisoformat(sale_date) if sale_date else date.today(),
        product=payload.get("product"),
        category=payload.get("category"),
        quantity=int(payload.get("quantity", 0)),
        unit_price=float(payload.get("unit_price", 0)),
        status="Delivered",
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

    model = Sale(
        date=date.fromisoformat(sale_date) if sale_date else date.today(),
        product=product.name,
        category=product.category,
        product_id=product.id,
        quantity=quantity,
        unit_price=float(product.price or 0),
        status="Pending",
        created_by=current.id,
    )

    product.stock = int(product.stock or 0) - quantity
    db.add(model)
    db.commit()
    db.refresh(model)
    return _serialize_order(model)


@router.patch("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin")),
):
    target_status = _requested_status(payload.get("status"))
    if not target_status:
        raise HTTPException(status_code=400, detail="Invalid status")

    order = db.query(Sale).filter(Sale.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    current_status = _normalized_status(order.status)
    if target_status == current_status:
        return _serialize_order(order)

    if target_status not in ADMIN_TRANSITIONS.get(current_status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move order from {current_status} to {target_status}",
        )

    order.status = target_status
    if target_status == "Cancelled" and order.product_id:
        product = db.query(Product).filter(Product.id == order.product_id).first()
        if product:
            product.stock = int(product.stock or 0) + int(order.quantity or 0)
            db.add(product)

    db.add(order)
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.post("/orders/{order_id}/cancel")
def cancel_order(
    order_id: int,
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
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.post("/orders/{order_id}/rating")
def rate_order(
    order_id: int,
    payload: dict,
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
    if _normalized_status(order.status) != "Delivered":
        raise HTTPException(status_code=400, detail="Only delivered orders can be rated")
    if order.rating is not None:
        raise HTTPException(status_code=400, detail="Order already rated")

    order.rating = rating
    order.rated_at = datetime.utcnow()
    db.add(order)

    _apply_product_rating_stats(db, order.product_id)

    db.commit()
    db.refresh(order)
    return _serialize_order(order)
