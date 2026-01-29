from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Product
from backend.app.schemas import ProductCreate

router = APIRouter(prefix="/products", tags=["Products"])

@router.get("/")
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).all()



@router.post("/", status_code=201)   
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    new_product = Product(
        name=product.name,
        category=product.category,
        price=product.price,
        stock=product.stock,
        description=product.description
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    return {
        "message": "Product created",
        "product": new_product
    }

@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"message": "Product deleted", "product_id": product_id}

# @router.put("/{product_id}")
# def update_product(product_id: int, product_data: ProductCreate, db: Session = Depends(get_db)):
#     product = db.query(Product).filter(Product.id == product_id).first()
#     if not product:
#         raise HTTPException(status_code=404, detail="Product not found")
    
#     product.name = product_data.name
#     product.category = product_data.category
#     product.price = product_data.price
#     product.stock = product_data.stock
#     product.description = product_data.description

#     db.commit()
#     db.refresh(product)

#     return {
#         "message": "Product updated",
#         "product": product
#     }