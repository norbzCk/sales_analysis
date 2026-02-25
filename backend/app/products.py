import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.app.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models import Product, User
from backend.app.schemas import ProductCreate

router = APIRouter(prefix="/products", tags=["Products"])
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


@router.post("/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    _: User = Depends(require_roles("admin", "super_admin")),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXT:
        raise HTTPException(status_code=400, detail="Unsupported image format")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{suffix}"
    destination = uploads_dir / filename

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")

    destination.write_bytes(content)
    return {"image_url": f"/uploads/{filename}"}

@router.get("/")
def get_products(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Product).all()


@router.get("/public")
def get_public_products(
    db: Session = Depends(get_db),
):
    items = db.query(Product).order_by(Product.id.desc()).limit(12).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "price": p.price,
            "image_url": p.image_url,
            "in_stock": bool((p.stock or 0) > 0),
            "rating_avg": p.rating_avg or 0,
            "rating_count": p.rating_count or 0,
        }
        for p in items
    ]


@router.get("/categories")
def get_product_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = (
        db.query(func.trim(Product.category))
        .filter(Product.category.isnot(None))
        .distinct()
        .order_by(func.trim(Product.category).asc())
        .all()
    )
    categories = [row[0] for row in rows if (row[0] or "").strip()]
    return {"categories": categories}


@router.get("/{product_id}")
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product



@router.post("/", status_code=201)   
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "super_admin")),
):
    new_product = Product(
        name=product.name,
        category=product.category,
        price=product.price,
        stock=product.stock,
        description=product.description,
        image_url=product.image_url,
)
    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    return {
        "message": "Product created",
        "product": new_product
    }

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "super_admin")),
):
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
