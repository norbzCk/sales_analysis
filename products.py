from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Product

router = APIRouter(prefix="/products", tags=["Products"])

@router.get("/")
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).all()

@router.post("/")
def create_product(product:ProductCreate, db: Session = Depends(get_db)):
    db_product = Product(name=product.name, category=product.category, price=product.price)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product