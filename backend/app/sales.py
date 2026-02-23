from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import String, cast
from sqlalchemy.orm import Session

from backend.app.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models import Product, Sale, User

router = APIRouter(tags=["Sales", "Orders"])


def _sales_query_for_current_user(db: Session, current: User):
    query = db.query(Sale)
    if current.role == "user":
        # Keep compatibility with legacy databases where created_by is varchar.
        query = query.filter(cast(Sale.created_by, String) == str(current.id))
    return query


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
        "created_by": model.created_by,
    }


@router.get("/orders/")
def get_orders(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    query = _sales_query_for_current_user(db, current)
    sales = query.order_by(Sale.date.desc(), Sale.id.desc()).all()
    return [
        {
            "id": s.id,
            "order_date": s.date.isoformat() if s.date else None,
            "product": s.product,
            "category": s.category,
            "quantity": s.quantity,
            "unit_price": s.unit_price,
            "total": (s.quantity or 0) * (s.unit_price or 0),
            "status": "Completed",
            "created_by": s.created_by,
        }
        for s in sales
    ]


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
        quantity=quantity,
        unit_price=float(product.price or 0),
        created_by=current.id,
    )

    product.stock = int(product.stock or 0) - quantity
    db.add(model)
    db.commit()
    db.refresh(model)
    return {
        "id": model.id,
        "order_date": model.date.isoformat() if model.date else None,
        "product": model.product,
        "category": model.category,
        "quantity": model.quantity,
        "unit_price": model.unit_price,
        "total": (model.quantity or 0) * (model.unit_price or 0),
        "status": "Completed",
        "created_by": model.created_by,
        "product_id": product.id,
    }
