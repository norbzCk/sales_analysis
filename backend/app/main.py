from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.app.dashboard import dashboard_stats, revenue_by_product, revenue_over_time

app = FastAPI()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    return dashboard_stats(db)

@app.get("/dashboard/revenue-product")
def get_revenue_product(db: Session = Depends(get_db)):
    return revenue_by_product(db)

@app.get("/dashboard/revenue-time")
def get_revenue_time(db: Session = Depends(get_db)):
    return revenue_over_time(db)

