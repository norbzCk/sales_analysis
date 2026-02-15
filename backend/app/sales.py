from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Sale

router = APIRouter(tags=["Sales", "Orders"])


@router.get("/sales/")
def get_sales(db: Session = Depends(get_db)):
    sales = db.query(Sale).order_by(Sale.date.desc(), Sale.id.desc()).all()
    return [
        {
            "id": s.id,
            "date": s.date.isoformat() if s.date else None,
            "product": s.product,
            "category": s.category,
            "quantity": s.quantity,
            "unit_price": s.unit_price,
            "revenue": (s.quantity or 0) * (s.unit_price or 0),
        }
        for s in sales
    ]


@router.post("/sales/", status_code=201)
def create_sale(payload: dict, db: Session = Depends(get_db)):
    sale_date = payload.get("date")
    model = Sale(
        date=date.fromisoformat(sale_date) if sale_date else date.today(),
        product=payload.get("product"),
        category=payload.get("category"),
        quantity=int(payload.get("quantity", 0)),
        unit_price=float(payload.get("unit_price", 0)),
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
    }


@router.get("/orders/")
def get_orders(db: Session = Depends(get_db)):
    sales = db.query(Sale).order_by(Sale.date.desc(), Sale.id.desc()).all()
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
        }
        for s in sales
    ]


@router.post("/orders/", status_code=201)
def create_order(payload: dict, db: Session = Depends(get_db)):
    sale_date = payload.get("order_date") or payload.get("date")
    model = Sale(
        date=date.fromisoformat(sale_date) if sale_date else date.today(),
        product=payload.get("product"),
        category=payload.get("category"),
        quantity=int(payload.get("quantity", 0)),
        unit_price=float(payload.get("unit_price", 0)),
    )
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
    }
