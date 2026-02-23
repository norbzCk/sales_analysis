from pathlib import Path

from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.app.auth import require_roles, router as auth_router
from backend.database import engine, get_db
from backend.app.products import router as products_router
from backend.app.customers import router as customers_router
from backend.app.sales import router as sales_router
from backend.models import Base, User
from fastapi.staticfiles import StaticFiles


from backend.app.dashboard import dashboard_stats, get_recent_sales, revenue_by_product, revenue_over_time
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


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

uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.include_router(products_router)
app.include_router(customers_router)
app.include_router(sales_router)
app.include_router(auth_router)



@app.get("/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin")),
):
    return dashboard_stats(db, current)

@app.get("/dashboard/revenue-product")
def get_revenue_product(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin")),
):
    return revenue_by_product(db, current)

@app.get("/dashboard/revenue-time")
def get_revenue_time(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin")),
):
    return revenue_over_time(db, current)

@app.get("/dashboard/recent-sales")
def recent_sales(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin")),
):
    return get_recent_sales(db, current)

    
