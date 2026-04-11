from pathlib import Path
import os

from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.app.auth import require_roles, router as auth_router
from backend.database import engine, get_db
from backend.app.products import router as products_router
from backend.app.customers import router as customers_router
from backend.app.sales import router as sales_router
from backend.app.rfq import router as rfq_router
from backend.app.providers import router as providers_router
from backend.app.payments import router as payments_router
from backend.app.business import router as business_router
from backend.app.logistics import router as logistics_router
from backend.models import Base, User
from fastapi.staticfiles import StaticFiles


from backend.app.dashboard import dashboard_stats, get_recent_sales, revenue_by_product, revenue_over_time
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS")
    if not raw:
        return ["*"]
    return [item.strip() for item in raw.split(",") if item.strip()]    


@app.on_event("startup")
def ensure_schema_columns():
    # Keep old DBs compatible with current models when migrations are missing.
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS products
                ADD COLUMN IF NOT EXISTS image_url VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS products
                ADD COLUMN IF NOT EXISTS rating_avg DOUBLE PRECISION DEFAULT 0
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS products
                ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS products
                ADD COLUMN IF NOT EXISTS provider_id INTEGER
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS users
                ADD COLUMN IF NOT EXISTS phone VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS users
                ADD COLUMN IF NOT EXISTS address VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS product_id INTEGER
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'Received'
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS rating INTEGER
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS provider_id INTEGER
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS provider_name VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS delivery_address VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS delivery_notes VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS delivery_method VARCHAR DEFAULT 'Standard'
                """
            )
        )
        
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS business_users (
                    id SERIAL PRIMARY KEY,
                    business_name VARCHAR NOT NULL,
                    owner_name VARCHAR NOT NULL,
                    phone VARCHAR UNIQUE NOT NULL,
                    email VARCHAR,
                    password_hash VARCHAR NOT NULL,
                    business_type VARCHAR DEFAULT 'individual',
                    category VARCHAR,
                    description VARCHAR,
                    region VARCHAR DEFAULT 'Dar es Salaam',
                    area VARCHAR,
                    street VARCHAR,
                    shop_number VARCHAR,
                    profile_photo VARCHAR,
                    verification_status VARCHAR DEFAULT 'unverified',
                    is_active BOOLEAN DEFAULT TRUE,
                    role VARCHAR DEFAULT 'seller',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
        )
        
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS business_metrics (
                    id SERIAL PRIMARY KEY,
                    business_id INTEGER UNIQUE NOT NULL,
                    rating DOUBLE PRECISION DEFAULT 0,
                    total_sales INTEGER DEFAULT 0,
                    reviews_count INTEGER DEFAULT 0,
                    total_revenue DOUBLE PRECISION DEFAULT 0
                )
                """
            )
        )
        
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS logistics_users (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    phone VARCHAR UNIQUE NOT NULL,
                    email VARCHAR,
                    password_hash VARCHAR NOT NULL,
                    account_type VARCHAR DEFAULT 'individual',
                    vehicle_type VARCHAR,
                    plate_number VARCHAR,
                    license_number VARCHAR,
                    base_area VARCHAR,
                    coverage_areas VARCHAR,
                    status VARCHAR DEFAULT 'offline',
                    availability VARCHAR DEFAULT 'available',
                    profile_photo VARCHAR,
                    verification_status VARCHAR DEFAULT 'unverified',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
        )
        
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS logistics_metrics (
                    id SERIAL PRIMARY KEY,
                    logistics_id INTEGER UNIQUE NOT NULL,
                    rating DOUBLE PRECISION DEFAULT 0,
                    total_deliveries INTEGER DEFAULT 0,
                    success_rate DOUBLE PRECISION DEFAULT 0,
                    cancel_rate DOUBLE PRECISION DEFAULT 0
                )
                """
            )
        )
        
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS delivery_orders (
                    id SERIAL PRIMARY KEY,
                    order_id INTEGER,
                    seller_id INTEGER,
                    buyer_id INTEGER,
                    logistics_id INTEGER,
                    pickup_location VARCHAR,
                    delivery_location VARCHAR,
                    pickup_phone VARCHAR,
                    delivery_phone VARCHAR,
                    status VARCHAR DEFAULT 'pending',
                    price DOUBLE PRECISION,
                    verification_code VARCHAR,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    picked_at TIMESTAMPTZ,
                    delivered_at TIMESTAMPTZ
                )
                """
            )
        )

uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.include_router(products_router)
app.include_router(customers_router)
app.include_router(sales_router)
app.include_router(rfq_router)
app.include_router(providers_router)
app.include_router(payments_router)
app.include_router(business_router)
app.include_router(logistics_router)
app.include_router(auth_router)



@app.get("/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    return dashboard_stats(db, current)

@app.get("/dashboard/revenue-product")
def get_revenue_product(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    return revenue_by_product(db, current)

@app.get("/dashboard/revenue-time")
def get_revenue_time(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    return revenue_over_time(db, current)

@app.get("/dashboard/recent-sales")
def recent_sales(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    return get_recent_sales(db, current)

@app.get("/dashboard/market-insights")
def get_market_insights(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    from backend.analysis.sales_analysis import market_insights, pricing_insights, demand_forecast
    return {
        "market": market_insights(db),
        "pricing": pricing_insights(db),
        "demand": demand_forecast(db)
    }

    
