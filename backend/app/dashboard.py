from sqlalchemy.orm import Session
from backend.models import Sale
from sqlalchemy import func

def dashboard_stats(db: Session):
    total_sales = db.query(func.sum(Sale.quantity * Sale.unit_price)).scalar() or 0
    total_orders = db.query(func.count(Sale.id)).scalar() or 0
    return {"total_sales": total_sales, "total_orders": total_orders}

def revenue_by_product(db: Session):
    result = db.query(Sale.product, func.sum(Sale.quantity * Sale.unit_price)).group_by(Sale.product).all()
    return [{"product": r[0], "revenue": r[1]} for r in result]

def revenue_over_time(db: Session):
    result = db.query(Sale.date, func.sum(Sale.quantity * Sale.unit_price)) \
               .group_by(Sale.date).order_by(Sale.date).all()
    return [{"date": str(r[0]), "revenue": r[1]} for r in result]

