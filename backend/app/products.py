import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.app.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models import Product, Provider, User
from backend.app.schemas import ProductCreate, ProductSearchQuery

router = APIRouter(prefix="/products", tags=["Products"])
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _serialize_provider(provider: Provider | None) -> dict | None:
    if not provider:
        return None
    return {
        "id": provider.id,
        "name": provider.name,
        "location": provider.location,
        "email": provider.email,
        "phone": provider.phone,
        "verified": provider.verified,
        "response_time": provider.response_time,
        "min_order_qty": provider.min_order_qty,
    }


def _serialize_product(product: Product, provider: Provider | None) -> dict:
    return {
        "id": product.id,
        "name": product.name,
        "category": product.category,
        "price": product.price,
        "stock": product.stock,
        "description": product.description,
        "image_url": product.image_url,
        "provider_id": product.provider_id,
        "provider": _serialize_provider(provider),
        "rating_avg": product.rating_avg or 0,
        "rating_count": product.rating_count or 0,
    }


def _serialize_public_product(product: Product, provider: Provider | None) -> dict:
    data = _serialize_product(product, provider)
    data["in_stock"] = bool((product.stock or 0) > 0)
    return data


@router.post("/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    _: User = Depends(require_roles("admin", "super_admin", "owner")),
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
    products = db.query(Product).order_by(Product.id.desc()).all()
    providers = {p.id: p for p in db.query(Provider).all()}
    return [_serialize_product(p, providers.get(p.provider_id)) for p in products]


@router.get("/public")
def get_public_products(
    db: Session = Depends(get_db),
):
    items = db.query(Product).order_by(Product.id.desc()).limit(12).all()
    providers = {p.id: p for p in db.query(Provider).all()}
    return [
        _serialize_public_product(p, providers.get(p.provider_id))
        for p in items
    ]


@router.get("/public/categories")
def get_public_categories(
    db: Session = Depends(get_db),
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


@router.get("/public/search")
def search_products(
    q: str | None = None,
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    in_stock: bool | None = None,
    sort: str = "featured",
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(Product)
    
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            (Product.name.ilike(search_term)) | 
            (Product.category.ilike(search_term)) |
            (Product.description.ilike(search_term))
        )
    
    if category:
        query = query.filter(func.trim(Product.category) == category)
    
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    
    if max_price is not None:
        query = query.filter(Product.price <= max_price)
    
    if in_stock is True:
        query = query.filter(Product.stock > 0)
    
    total = query.count()
    
    if sort == "price_low":
        query = query.order_by(Product.price.asc())
    elif sort == "price_high":
        query = query.order_by(Product.price.desc())
    elif sort == "rating":
        query = query.order_by(Product.rating_avg.desc())
    elif sort == "newest":
        query = query.order_by(Product.id.desc())
    else:
        query = query.order_by(Product.id.desc())
    
    items = query.offset(offset).limit(limit).all()
    providers = {p.id: p for p in db.query(Provider).all()}
    
    rows = (
        db.query(func.trim(Product.category))
        .filter(Product.category.isnot(None))
        .distinct()
        .order_by(func.trim(Product.category).asc())
        .all()
    )
    categories = [row[0] for row in rows if (row[0] or "").strip()]
    
    return {
        "items": [_serialize_public_product(p, providers.get(p.provider_id)) for p in items],
        "total": total,
        "categories": categories
    }


@router.get("/marketplace")
def get_marketplace_products(
    q: str | None = None,
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    in_stock: bool | None = None,
    sort: str = "featured",
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    return search_products(
        q=q, category=category, min_price=min_price,
        max_price=max_price, in_stock=in_stock,
        sort=sort, limit=limit, offset=offset, db=db
    )


@router.get("/{product_id}")
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    provider = None
    if product.provider_id:
        provider = db.query(Provider).filter(Provider.id == product.provider_id).first()
    return _serialize_product(product, provider)



@router.post("/", status_code=201)   
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    provider = None
    if product.provider_id:
        provider = db.query(Provider).filter(Provider.id == product.provider_id).first()
        if not provider:
            raise HTTPException(status_code=400, detail="Provider not found")
    new_product = Product(
        name=product.name,
        category=product.category,
        price=product.price,
        stock=product.stock,
        description=product.description,
        image_url=product.image_url,
        provider_id=provider.id if provider else None,
)
    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    return {
        "message": "Product created",
        "product": _serialize_product(new_product, provider)
    }

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"message": "Product deleted", "product_id": product_id}

@router.put("/{product_id}")
def update_product(
    product_id: int,
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.name = product_data.name
    product.category = product_data.category
    product.price = product_data.price
    product.stock = product_data.stock
    product.description = product_data.description
    product.image_url = product_data.image_url
    
    if product_data.provider_id:
        provider = db.query(Provider).filter(Provider.id == product_data.provider_id).first()
        if provider:
            product.provider_id = provider.id

    db.commit()
    db.refresh(product)
    
    provider = None
    if product.provider_id:
        provider = db.query(Provider).filter(Provider.id == product.provider_id).first()

    return {
        "message": "Product updated",
        "product": _serialize_product(product, provider)
    }


@router.get("/inventory/stats")
def get_inventory_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    products = db.query(Product).all()
    providers = {p.id: p for p in db.query(Provider).all()}
    
    total_products = len(products)
    low_stock_count = 0
    out_of_stock_count = 0
    total_value = 0.0
    alerts = []
    
    for product in products:
        stock = product.stock or 0
        price = product.price or 0
        total_value += stock * price
        
        if stock == 0:
            out_of_stock_count += 1
        elif stock < 5:
            low_stock_count += 1
            provider = providers.get(product.provider_id) if product.provider_id else None
            alerts.append({
                "product_id": product.id,
                "product_name": product.name,
                "current_stock": stock,
                "low_stock_threshold": 5,
                "provider_id": product.provider_id,
                "provider_name": provider.name if provider else None
            })
    
    return {
        "total_products": total_products,
        "low_stock_count": low_stock_count,
        "out_of_stock_count": out_of_stock_count,
        "total_value": total_value,
        "alerts": alerts[:10]
    }
