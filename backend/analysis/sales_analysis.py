from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.models import Sale, Product, Provider, Customer

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


def market_insights(db: Session):
    total_products = db.query(Product).count()
    total_providers = db.query(Provider).count()
    total_customers = db.query(Customer).count()
    
    low_stock = db.query(Product).filter(Product.stock < 5).count()
    out_of_stock = db.query(Product).filter(Product.stock == 0).count()
    
    avg_price = db.query(func.avg(Product.price)).scalar() or 0
    
    top_categories = db.query(
        Product.category,
        func.count(Product.id).label("count"),
        func.avg(Product.price).label("avg_price")
    ).group_by(Product.category).order_by(func.count(Product.id).desc()).limit(5).all()
    
    verified_providers = db.query(Provider).filter(Provider.verified == True).count()
    
    return {
        "total_products": total_products,
        "total_providers": total_providers,
        "total_customers": total_customers,
        "low_stock_count": low_stock,
        "out_of_stock_count": out_of_stock,
        "average_product_price": float(avg_price),
        "verified_providers": verified_providers,
        "top_categories": [
            {
                "category": cat,
                "product_count": count,
                "avg_price": float(avg_price) if avg_price else 0
            }
            for cat, count, avg_price in top_categories
        ]
    }


def pricing_insights(db: Session):
    min_price = db.query(func.min(Product.price)).scalar() or 0
    max_price = db.query(func.max(Product.price)).scalar() or 0
    avg_price = db.query(func.avg(Product.price)).scalar() or 0
    median_price = db.query(Product).order_by(Product.price).offset(
        db.query(func.count(Product.id)).scalar() // 2
    ).first()
    
    price_ranges = [
        {"range": "Under 1000", "count": db.query(Product).filter(Product.price < 1000).count()},
        {"range": "1000-5000", "count": db.query(Product).filter(Product.price >= 1000, Product.price < 5000).count()},
        {"range": "5000-20000", "count": db.query(Product).filter(Product.price >= 5000, Product.price < 20000).count()},
        {"range": "20000-50000", "count": db.query(Product).filter(Product.price >= 20000, Product.price < 50000).count()},
        {"range": "Over 50000", "count": db.query(Product).filter(Product.price >= 50000).count()},
    ]
    
    return {
        "min_price": float(min_price),
        "max_price": float(max_price),
        "avg_price": float(avg_price),
        "median_price": float(median_price.price) if median_price else 0,
        "price_ranges": price_ranges
    }


def demand_forecast(db: Session):
    rows = db.query(
        func.extract("month", Sale.date).label("month"),
        func.sum(Sale.quantity).label("total_qty"),
        func.sum(Sale.quantity * Sale.unit_price).label("revenue")
    ).filter(Sale.date.isnot(None)).group_by(
        func.extract("month", Sale.date)
    ).order_by("month").all()
    
    monthly_data = []
    for month, qty, revenue in rows:
        monthly_data.append({
            "month": int(month) if month else 0,
            "quantity": int(qty) if qty else 0,
            "revenue": float(revenue) if revenue else 0
        })
    
    return {
        "monthly_sales": monthly_data,
        "trend": "increasing" if (len(monthly_data) > 1 and monthly_data[-1]["revenue"] > monthly_data[0]["revenue"]) else "stable"
    }

