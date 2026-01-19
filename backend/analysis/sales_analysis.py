from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.models import Sale

def dashboard_stats(db: Session):
    total_revenue = db.query(
        func.sum(Sale.quantity * Sale.unit_price)
    ).scalar() or 0

    total_orders = db.query(Sale.id).count()

    total_units = db.query(
        func.sum(Sale.quantity)
    ).scalar() or 0

    top_product = db.query(
        Sale.product,
        func.sum(Sale.quantity * Sale.unit_price).label("revenue")
    ).group_by(Sale.product).order_by(
        func.sum(Sale.quantity * Sale.unit_price).desc()
    ).first()

    return {
        "total_revenue": float(total_revenue),
        "total_orders": total_orders,
        "total_units": int(total_units),
        "top_product": top_product[0] if top_product else None
    }

def revenue_by_product(db: Session):
    rows = db.query(
        Sale.product,
        func.sum(Sale.quantity * Sale.unit_price)
    ).group_by(Sale.product).all()

    return {
        product: float(revenue)
        for product, revenue in rows
    }

def revenue_over_time(db: Session):
    rows = db.query(
        Sale.date,
        func.sum(Sale.quantity * Sale.unit_price)
    ).group_by(Sale.date).order_by(Sale.date).all()

    return {
        str(date): float(revenue)
        for date, revenue in rows
    }

