from pathlib import Path
import os

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.app.auth import hash_password, require_roles, router as auth_router
from backend.app.ai_assistant import router as ai_assistant_router
from backend.app.notification_service import create_notification, resolve_subject
from backend.database import engine, get_db
from backend.app.products import router as products_router
from backend.app.customers import router as customers_router
from backend.app.sales import router as sales_router
from backend.app.rfq import router as rfq_router
from backend.app.providers import router as providers_router
from backend.app.payments import router as payments_router
from backend.app.business import router as business_router
from backend.app.logistics import router as logistics_router
from backend.app.notifications import router as notifications_router
from backend.models import Base, User, BusinessMetrics, BusinessUser, LogisticsMetrics, LogisticsUser, Product, Provider
from fastapi.staticfiles import StaticFiles
from backend.app.marketplace_intelligence import build_superadmin_overview


from backend.app.dashboard import dashboard_analytics, dashboard_stats, get_recent_sales, revenue_by_product, revenue_over_time
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


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
                ALTER TABLE IF EXISTS products
                ADD COLUMN IF NOT EXISTS seller_id INTEGER
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS products
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
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
                ALTER TABLE IF EXISTS users
                ADD COLUMN IF NOT EXISTS profile_photo VARCHAR
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
                ALTER TABLE IF EXISTS delivery_orders
                ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS delivery_orders
                ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS delivery_orders
                ADD COLUMN IF NOT EXISTS destination_lat DOUBLE PRECISION
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS delivery_orders
                ADD COLUMN IF NOT EXISTS destination_lng DOUBLE PRECISION
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS delivery_orders
                ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS delivery_orders
                ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS delivery_orders
                ADD COLUMN IF NOT EXISTS estimated_distance_km DOUBLE PRECISION
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS delivery_orders
                ADD COLUMN IF NOT EXISTS last_location_name VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS delivery_orders
                ADD COLUMN IF NOT EXISTS tracking_updated_at TIMESTAMPTZ
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
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
                ADD COLUMN IF NOT EXISTS seller_id INTEGER
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS sales
                ADD COLUMN IF NOT EXISTS status_reason VARCHAR
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
                    operating_hours VARCHAR,
                    shop_logo_url VARCHAR,
                    shop_images VARCHAR,
                    profile_photo VARCHAR,
                    website_url VARCHAR,
                    social_facebook VARCHAR,
                    social_instagram VARCHAR,
                    social_whatsapp VARCHAR,
                    social_x VARCHAR,
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
                ALTER TABLE IF EXISTS business_users
                ADD COLUMN IF NOT EXISTS auto_confirm BOOLEAN DEFAULT FALSE
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS business_users
                ADD COLUMN IF NOT EXISTS operating_hours VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS business_users
                ADD COLUMN IF NOT EXISTS shop_logo_url VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS business_users
                ADD COLUMN IF NOT EXISTS shop_images VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS business_users
                ADD COLUMN IF NOT EXISTS website_url VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS business_users
                ADD COLUMN IF NOT EXISTS social_facebook VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS business_users
                ADD COLUMN IF NOT EXISTS social_instagram VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS business_users
                ADD COLUMN IF NOT EXISTS social_whatsapp VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS business_users
                ADD COLUMN IF NOT EXISTS social_x VARCHAR
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
                    special_instructions VARCHAR,
                    verification_code VARCHAR,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    picked_at TIMESTAMPTZ,
                    delivered_at TIMESTAMPTZ
                )
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS delivery_orders
                ADD COLUMN IF NOT EXISTS special_instructions VARCHAR
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS notifications (
                    id SERIAL PRIMARY KEY,
                    recipient_type VARCHAR NOT NULL,
                    recipient_id INTEGER NOT NULL,
                    title VARCHAR NOT NULL,
                    message VARCHAR NOT NULL,
                    notification_type VARCHAR DEFAULT 'system',
                    severity VARCHAR DEFAULT 'info',
                    action_href VARCHAR,
                    metadata_json VARCHAR,
                    is_read BOOLEAN DEFAULT FALSE,
                    email VARCHAR,
                    email_subject VARCHAR,
                    email_status VARCHAR DEFAULT 'not_requested',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    read_at TIMESTAMPTZ
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS payment_transactions (
                    id SERIAL PRIMARY KEY,
                    transaction_id VARCHAR UNIQUE NOT NULL,
                    order_id INTEGER NOT NULL,
                    payer_type VARCHAR NOT NULL,
                    payer_id INTEGER NOT NULL,
                    amount DOUBLE PRECISION NOT NULL,
                    payment_method VARCHAR NOT NULL,
                    provider VARCHAR,
                    phone_number VARCHAR,
                    status VARCHAR DEFAULT 'pending',
                    message VARCHAR,
                    instructions VARCHAR,
                    metadata_json VARCHAR,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    confirmed_at TIMESTAMPTZ
                )
                """
            )
        )

    with Session(engine) as db:
        seed_marketplace_demo_data(db)


def seed_marketplace_demo_data(db: Session) -> None:
    if db.query(Product).filter(Product.is_active.isnot(False)).count() > 0:
        return

    demo_sellers = [
        {
            "business_name": "Kariakoo Fresh Hub",
            "owner_name": "Amina Salim",
            "phone": "+255700100001",
            "email": "seller1@sokolink.local",
            "region": "Dar es Salaam",
            "area": "Kariakoo",
            "street": "Msimbazi Street",
            "category": "Fresh Produce",
        },
        {
            "business_name": "Coastal Home Supplies",
            "owner_name": "Juma Mushi",
            "phone": "+255700100002",
            "email": "seller2@sokolink.local",
            "region": "Dar es Salaam",
            "area": "Ilala",
            "street": "Uhuru Street",
            "category": "Household",
        },
    ]
    sellers: list[BusinessUser] = []
    for entry in demo_sellers:
        existing = db.query(BusinessUser).filter(BusinessUser.phone == entry["phone"]).first()
        if existing:
            sellers.append(existing)
            continue
        model = BusinessUser(
            business_name=entry["business_name"],
            owner_name=entry["owner_name"],
            phone=entry["phone"],
            email=entry["email"],
            password_hash=hash_password("demo12345"),
            business_type="individual",
            category=entry["category"],
            region=entry["region"],
            area=entry["area"],
            street=entry["street"],
            role="seller",
            is_active=True,
            verification_status="verified",
        )
        db.add(model)
        db.flush()
        db.add(BusinessMetrics(business_id=model.id))
        sellers.append(model)

    provider = db.query(Provider).filter(Provider.name == "SokoLnk Demo Supplier").first()
    if not provider:
        provider = Provider(
            name="SokoLnk Demo Supplier",
            location="Dar es Salaam",
            email="supplier@sokolink.local",
            phone="+255700100010",
            verified=True,
            response_time="< 3 hrs",
            min_order_qty="20 units",
        )
        db.add(provider)
        db.flush()

    demo_products = [
        {
            "name": "Premium Rice 25kg",
            "category": "Groceries",
            "price": 69000,
            "stock": 44,
            "description": "Long grain rice sourced for retail and wholesale orders.",
            "seller_idx": 0,
        },
        {
            "name": "Sunflower Cooking Oil 5L",
            "category": "Groceries",
            "price": 26500,
            "stock": 62,
            "description": "Refined cooking oil for households and restaurants.",
            "seller_idx": 1,
        },
        {
            "name": "Laundry Soap Bar Pack",
            "category": "Household",
            "price": 12000,
            "stock": 90,
            "description": "Durable multipurpose soap bars in bulk-friendly packs.",
            "seller_idx": 1,
        },
    ]
    for entry in demo_products:
        if db.query(Product).filter(Product.name == entry["name"]).first():
            continue
        seller = sellers[entry["seller_idx"]] if sellers else None
        db.add(
            Product(
                name=entry["name"],
                category=entry["category"],
                price=entry["price"],
                stock=entry["stock"],
                description=entry["description"],
                seller_id=seller.id if seller else None,
                provider_id=provider.id if provider else None,
                is_active=True,
            )
        )

    db.commit()

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
app.include_router(notifications_router)
app.include_router(auth_router)
app.include_router(ai_assistant_router)


@app.get("/superadmin/stats")
def superadmin_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    return build_superadmin_overview(db)


@app.get("/superadmin/me")
def superadmin_me(
    current: User = Depends(require_roles("super_admin", "owner")),
):
    return {
        "id": current.id,
        "name": current.name,
        "email": current.email,
        "role": current.role,
        "is_active": current.is_active,
    }


@app.get("/superadmin/businessmen")
def superadmin_businessmen(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    items = db.query(BusinessUser).order_by(BusinessUser.created_at.desc(), BusinessUser.id.desc()).all()
    return [
        {
            "id": item.id,
            "business_name": item.business_name,
            "owner_name": item.owner_name,
            "email": item.email,
            "phone": item.phone,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in items
    ]


@app.post("/superadmin/businessmen", status_code=201)
def create_superadmin_businessman(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    business_name = (payload.get("business_name") or "").strip()
    owner_name = (payload.get("owner_name") or "").strip()
    phone = (payload.get("phone") or "").strip()
    email = (payload.get("email") or "").strip().lower() or None
    password = payload.get("password") or ""

    if len(business_name) < 2 or len(owner_name) < 2:
        raise HTTPException(status_code=400, detail="Business name and owner name are required")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")
    if email and "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing_phone = db.query(BusinessUser).filter(BusinessUser.phone == phone).first()
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    if email:
        existing_email = db.query(BusinessUser).filter(text("lower(email) = :email")).params(email=email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")

    model = BusinessUser(
        business_name=business_name,
        owner_name=owner_name,
        phone=phone,
        email=email,
        password_hash=hash_password(password),
        business_type=(payload.get("business_type") or "individual").strip() or "individual",
        category=(payload.get("category") or "").strip() or None,
        description=(payload.get("description") or "").strip() or None,
        region=(payload.get("region") or "Dar es Salaam").strip() or "Dar es Salaam",
        area=(payload.get("area") or "").strip() or None,
        street=(payload.get("street") or "").strip() or None,
        shop_number=(payload.get("shop_number") or "").strip() or None,
        operating_hours=(payload.get("operating_hours") or "").strip() or None,
        shop_logo_url=(payload.get("shop_logo_url") or "").strip() or None,
        shop_images=(payload.get("shop_images") or "").strip() or None,
        profile_photo=(payload.get("profile_photo") or "").strip() or None,
        website_url=(payload.get("website_url") or "").strip() or None,
        social_facebook=(payload.get("social_facebook") or "").strip() or None,
        social_instagram=(payload.get("social_instagram") or "").strip() or None,
        social_whatsapp=(payload.get("social_whatsapp") or "").strip() or None,
        social_x=(payload.get("social_x") or "").strip() or None,
        role="seller",
        is_active=True,
    )
    db.add(model)
    db.commit()
    db.refresh(model)

    db.add(BusinessMetrics(business_id=model.id))
    recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(model)
    create_notification(
        db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        recipient_email=recipient_email,
        title="A business account was created for you",
        message="Your SokoLnk seller account has been created by an administrator. You can now sign in and manage your storefront.",
        notification_type="system",
        severity="success",
        action_href="/login",
        send_email=bool(recipient_email),
        email_subject="Your SokoLnk seller account is ready",
        email_body=f"Hello {recipient_name},\n\nAn administrator created your seller account. You can sign in and start using SokoLnk.\n\nSokoLnk Team",
        background_tasks=background_tasks,
    )
    db.commit()

    return {
        "id": model.id,
        "business_name": model.business_name,
        "owner_name": model.owner_name,
        "email": model.email,
        "phone": model.phone,
        "created_at": model.created_at.isoformat() if model.created_at else None,
    }


@app.get("/superadmin/customers")
def superadmin_customers(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    items = (
        db.query(User)
        .filter(User.role == "user")
        .order_by(User.created_at.desc(), User.id.desc())
        .all()
    )
    return [
        {
            "id": item.id,
            "name": item.name,
            "email": item.email,
            "phone": item.phone,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in items
    ]


@app.post("/superadmin/customers", status_code=201)
def create_superadmin_customer(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip() or None
    password = payload.get("password") or ""

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name is required")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    model = User(
        name=name,
        email=email,
        phone=phone,
        password_hash=hash_password(password),
        role="user",
        is_active=True,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(model)
    create_notification(
        db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        recipient_email=recipient_email,
        title="A customer account was created for you",
        message="Your SokoLnk buyer account has been created by an administrator.",
        notification_type="system",
        severity="success",
        action_href="/login",
        send_email=bool(recipient_email),
        email_subject="Your SokoLnk buyer account is ready",
        email_body=f"Hello {recipient_name},\n\nAn administrator created your buyer account.\n\nSokoLnk Team",
        background_tasks=background_tasks,
    )
    db.commit()

    return {
        "id": model.id,
        "name": model.name,
        "email": model.email,
        "phone": model.phone,
        "created_at": model.created_at.isoformat() if model.created_at else None,
    }


@app.get("/superadmin/logistics")
def superadmin_logistics(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    items = db.query(LogisticsUser).order_by(LogisticsUser.created_at.desc(), LogisticsUser.id.desc()).all()
    return [
        {
            "id": item.id,
            "name": item.name,
            "email": item.email,
            "phone": item.phone,
            "account_type": item.account_type,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in items
    ]


@app.get("/superadmin/verifications")
def superadmin_verifications(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    sellers = (
        db.query(BusinessUser)
        .order_by(BusinessUser.verification_status.asc(), BusinessUser.created_at.desc(), BusinessUser.id.desc())
        .all()
    )
    logistics_items = (
        db.query(LogisticsUser)
        .order_by(LogisticsUser.verification_status.asc(), LogisticsUser.created_at.desc(), LogisticsUser.id.desc())
        .all()
    )
    return {
        "businessmen": [
            {
                "id": item.id,
                "business_name": item.business_name,
                "owner_name": item.owner_name,
                "phone": item.phone,
                "email": item.email,
                "category": item.category,
                "region": item.region,
                "area": item.area,
                "verification_status": item.verification_status,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in sellers
        ],
        "logistics": [
            {
                "id": item.id,
                "name": item.name,
                "phone": item.phone,
                "email": item.email,
                "vehicle_type": item.vehicle_type,
                "base_area": item.base_area,
                "coverage_areas": item.coverage_areas,
                "verification_status": item.verification_status,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in logistics_items
        ],
    }


@app.patch("/superadmin/businessmen/{business_id}/verification")
def update_superadmin_business_verification(
    business_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    item = db.query(BusinessUser).filter(BusinessUser.id == business_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Business account not found")

    status = str(payload.get("status") or "").strip().lower()
    if status not in {"verified", "pending", "rejected", "unverified"}:
        raise HTTPException(status_code=400, detail="Invalid verification status")

    item.verification_status = status
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "message": "Business verification updated",
        "id": item.id,
        "verification_status": item.verification_status,
    }


@app.patch("/superadmin/logistics/{logistics_id}/verification")
def update_superadmin_logistics_verification(
    logistics_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    item = db.query(LogisticsUser).filter(LogisticsUser.id == logistics_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Logistics account not found")

    status = str(payload.get("status") or "").strip().lower()
    if status not in {"verified", "pending", "rejected", "unverified"}:
        raise HTTPException(status_code=400, detail="Invalid verification status")

    item.verification_status = status
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "message": "Logistics verification updated",
        "id": item.id,
        "verification_status": item.verification_status,
    }


@app.post("/superadmin/logistics", status_code=201)
def create_superadmin_logistics(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower() or None
    phone = (payload.get("phone") or "").strip()
    password = payload.get("password") or ""

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name is required")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")
    if email and "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing_phone = db.query(LogisticsUser).filter(LogisticsUser.phone == phone).first()
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    if email:
        existing_email = db.query(LogisticsUser).filter(text("lower(email) = :email")).params(email=email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")

    model = LogisticsUser(
        name=name,
        phone=phone,
        email=email,
        password_hash=hash_password(password),
        account_type=(payload.get("account_type") or "individual").strip() or "individual",
        vehicle_type=(payload.get("vehicle_type") or "").strip() or None,
        plate_number=(payload.get("plate_number") or "").strip() or None,
        license_number=(payload.get("license_number") or "").strip() or None,
        base_area=(payload.get("base_area") or "").strip() or None,
        coverage_areas=(payload.get("coverage_areas") or "").strip() or None,
        is_active=True,
    )
    db.add(model)
    db.commit()
    db.refresh(model)

    db.add(LogisticsMetrics(logistics_id=model.id))
    recipient_type, recipient_id, recipient_email, recipient_name = resolve_subject(model)
    create_notification(
        db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        recipient_email=recipient_email,
        title="A logistics account was created for you",
        message="Your SokoLnk delivery account has been created by an administrator.",
        notification_type="system",
        severity="success",
        action_href="/login",
        send_email=bool(recipient_email),
        email_subject="Your SokoLnk delivery account is ready",
        email_body=f"Hello {recipient_name},\n\nAn administrator created your delivery account.\n\nSokoLnk Team",
        background_tasks=background_tasks,
    )
    db.commit()

    return {
        "id": model.id,
        "name": model.name,
        "email": model.email,
        "phone": model.phone,
        "account_type": model.account_type,
        "created_at": model.created_at.isoformat() if model.created_at else None,
    }


@app.delete("/superadmin/businessmen/{business_id}")
def delete_superadmin_businessman(
    business_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    item = db.query(BusinessUser).filter(BusinessUser.id == business_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Business account not found")
    db.delete(item)
    db.commit()
    return {"message": "Business account deleted"}


@app.delete("/superadmin/customers/{customer_id}")
def delete_superadmin_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    item = db.query(User).filter(User.id == customer_id, User.role == "user").first()
    if not item:
        raise HTTPException(status_code=404, detail="Customer account not found")
    db.delete(item)
    db.commit()
    return {"message": "Customer account deleted"}


@app.delete("/superadmin/logistics/{logistics_id}")
def delete_superadmin_logistics(
    logistics_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("super_admin", "owner")),
):
    item = db.query(LogisticsUser).filter(LogisticsUser.id == logistics_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Logistics account not found")
    db.delete(item)
    db.commit()
    return {"message": "Logistics account deleted"}



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

@app.get("/dashboard/analytics")
def get_dashboard_analytics(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    return dashboard_analytics(db, current)

@app.get("/dashboard/market-insights")
def get_market_insights(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    from backend.analysis.sales_analysis import market_insights, pricing_insights, demand_forecast, peak_sales_periods, customer_buying_patterns
    return {
        "market": market_insights(db),
        "pricing": pricing_insights(db),
        "demand": demand_forecast(db),
        "peak_periods": peak_sales_periods(db),
        "customer_patterns": customer_buying_patterns(db)
    }

@app.get("/dashboard/export-sales")
def export_sales_report(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "super_admin", "owner")),
):
    import csv
    import io
    from fastapi.responses import StreamingResponse
    from backend.models import Sale

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Date", "Product", "Category", "Quantity", "Unit Price", "Total", "Status"])

    sales = db.query(Sale).order_by(Sale.date.desc()).all()
    for s in sales:
        writer.writerow([
            s.id,
            s.date.isoformat() if s.date else "",
            s.product,
            s.category,
            s.quantity,
            s.unit_price,
            (s.quantity or 0) * (s.unit_price or 0),
            s.status
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sales_report.csv"}
    )

    
