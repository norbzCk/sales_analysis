from sqlalchemy import func
from backend.models import Sale

def dashboard_stats(db):
    total_revenue = db.query(func.sum(Sale.quantity * Sale.unit_price)).scalar() or 0
    total_orders = db.query(func.count(Sale.id)).scalar() or 0
    total_units = db.query(func.sum(Sale.quantity)).scalar() or 0
    top_product_row = db.query(Sale.product, func.sum(Sale.quantity * Sale.unit_price).label("revenue")) \
                        .group_by(Sale.product) \
                        .order_by(func.sum(Sale.quantity * Sale.unit_price).desc()) \
                        .first()
    top_product = top_product_row[0] if top_product_row else "-"
    return {
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "total_units": total_units,
        "top_product": top_product
    }

def revenue_by_product(db):
    rows = db.query(Sale.product, func.sum(Sale.quantity * Sale.unit_price)) \
             .group_by(Sale.product).all()
    return {r[0]: r[1] for r in rows}

def revenue_over_time(db):
    rows = db.query(Sale.date, func.sum(Sale.quantity * Sale.unit_price)) \
             .group_by(Sale.date).order_by(Sale.date).all()
    return {r[0].isoformat(): r[1] for r in rows}


def get_recent_sales(db):
    sales = db.query(Sale).order_by(Sale.date.desc()).limit(5).all()
    return [
        {
            "date": s.date.isoformat(),
            "product": s.product,
            "category": s.category,
            "quantity": s.quantity,
            "revenue": s.quantity * s.unit_price
        }
        for s in sales
    ]

