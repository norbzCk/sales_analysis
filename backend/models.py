from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date)
    product = Column(String)
    category = Column(String)
    product_id = Column(Integer, nullable=True)
    provider_id = Column(Integer, nullable=True)
    provider_name = Column(String, nullable=True)
    seller_id = Column(Integer, nullable=True)
    quantity = Column(Integer)
    unit_price = Column(Float)
    status = Column(String, nullable=False, default="Pending")
    status_reason = Column(String, nullable=True)
    rating = Column(Integer, nullable=True)
    rated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, nullable=True)
    delivery_address = Column(String, nullable=True)
    delivery_phone = Column(String, nullable=True)
    delivery_notes = Column(String, nullable=True)
    delivery_method = Column(String, nullable=True, default="Standard")


class Provider(Base):
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    verified = Column(Boolean, nullable=False, default=False)
    response_time = Column(String, nullable=True)
    min_order_qty = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    stock = Column(Integer , nullable=False)
    description = Column(String)
    image_url = Column(String, nullable=True)
    seller_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    provider_id = Column(Integer, nullable=True)
    rating_avg = Column(Float, nullable=False, default=0.0)
    rating_count = Column(Integer, nullable=False, default=0)

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=True)
    email = Column(String, nullable=True)
    location = Column(String, nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    profile_photo = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RFQ(Base):
    __tablename__ = "rfqs"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    contact_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    product_interest = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    target_budget = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    status = Column(String, nullable=False, default="New")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BusinessUser(Base):
    __tablename__ = "business_users"

    id = Column(Integer, primary_key=True, index=True)
    business_name = Column(String, nullable=False)
    owner_name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    business_type = Column(String, nullable=False, default="individual")  # individual, company
    category = Column(String, nullable=True)  # clothes, electronics, food, wholesale, retail
    description = Column(String, nullable=True)
    region = Column(String, nullable=True, default="Dar es Salaam")
    area = Column(String, nullable=True)  # Kariakoo, Ilala, Kinondoni
    street = Column(String, nullable=True)
    shop_number = Column(String, nullable=True)
    operating_hours = Column(String, nullable=True)
    shop_logo_url = Column(String, nullable=True)
    shop_images = Column(String, nullable=True)  # comma-separated image URLs
    profile_photo = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    social_facebook = Column(String, nullable=True)
    social_instagram = Column(String, nullable=True)
    social_whatsapp = Column(String, nullable=True)
    social_x = Column(String, nullable=True)
    auto_confirm = Column(Boolean, nullable=False, default=False)
    verification_status = Column(String, nullable=False, default="unverified")  # unverified, pending, verified
    is_active = Column(Boolean, nullable=False, default=True)
    role = Column(String, nullable=False, default="seller")  # seller, buyer
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BusinessVerification(Base):
    __tablename__ = "business_verification"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, nullable=False)
    document_type = Column(String, nullable=True)  # national_id, business_license
    document_url = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending")  # pending, approved, rejected
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)


class BusinessMetrics(Base):
    __tablename__ = "business_metrics"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, nullable=False, unique=True)
    rating = Column(Float, nullable=False, default=0.0)
    total_sales = Column(Integer, nullable=False, default=0)
    reviews_count = Column(Integer, nullable=False, default=0)
    total_revenue = Column(Float, nullable=False, default=0.0)


class LogisticsUser(Base):
    __tablename__ = "logistics_users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    account_type = Column(String, nullable=False, default="individual")  # individual, company
    vehicle_type = Column(String, nullable=True)  # motorcycle, car, van, truck
    plate_number = Column(String, nullable=True)
    license_number = Column(String, nullable=True)
    base_area = Column(String, nullable=True)  # Kariakoo, Ilala, Kinondoni
    coverage_areas = Column(String, nullable=True)  # comma-separated areas
    status = Column(String, nullable=False, default="offline")  # online, offline
    availability = Column(String, nullable=False, default="available")  # available, busy
    profile_photo = Column(String, nullable=True)
    verification_status = Column(String, nullable=False, default="unverified")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LogisticsMetrics(Base):
    __tablename__ = "logistics_metrics"

    id = Column(Integer, primary_key=True, index=True)
    logistics_id = Column(Integer, nullable=False, unique=True)
    rating = Column(Float, nullable=False, default=0.0)
    total_deliveries = Column(Integer, nullable=False, default=0)
    success_rate = Column(Float, nullable=False, default=0.0)
    cancel_rate = Column(Float, nullable=False, default=0.0)


class DeliveryOrder(Base):
    __tablename__ = "delivery_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, nullable=True)  # reference to Sale
    seller_id = Column(Integer, nullable=True)
    buyer_id = Column(Integer, nullable=True)
    logistics_id = Column(Integer, nullable=True)
    pickup_location = Column(String, nullable=True)
    delivery_location = Column(String, nullable=True)
    pickup_phone = Column(String, nullable=True)
    delivery_phone = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending")  # pending, assigned, picked_up, in_transit, delivered, cancelled
    price = Column(Float, nullable=True)
    special_instructions = Column(String, nullable=True)
    verification_code = Column(String, nullable=True)  # OTP for delivery confirmation
    pickup_lat = Column(Float, nullable=True)
    pickup_lng = Column(Float, nullable=True)
    destination_lat = Column(Float, nullable=True)
    destination_lng = Column(Float, nullable=True)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    estimated_distance_km = Column(Float, nullable=True)
    last_location_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    picked_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    tracking_updated_at = Column(DateTime(timezone=True), nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_type = Column(String, nullable=False, index=True)
    recipient_id = Column(Integer, nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    notification_type = Column(String, nullable=False, default="system")
    severity = Column(String, nullable=False, default="info")
    action_href = Column(String, nullable=True)
    metadata_json = Column(String, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    email = Column(String, nullable=True)
    email_subject = Column(String, nullable=True)
    email_status = Column(String, nullable=False, default="not_requested")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String, nullable=False, unique=True, index=True)
    order_id = Column(Integer, nullable=False, index=True)
    payer_type = Column(String, nullable=False, index=True)
    payer_id = Column(Integer, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False)
    provider = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending", index=True)
    message = Column(String, nullable=True)
    instructions = Column(String, nullable=True)
    metadata_json = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    confirmed_at = Column(DateTime(timezone=True), nullable=True)


class AssistantConversation(Base):
    __tablename__ = "assistant_conversations"

    id = Column(String, primary_key=True, index=True)
    subject_type = Column(String, nullable=False, default="guest", index=True)
    subject_id = Column(Integer, nullable=True, index=True)
    current_path = Column(String, nullable=True)
    title = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)


class AssistantConversationMessage(Base):
    __tablename__ = "assistant_conversation_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String, ForeignKey("assistant_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    source = Column(String, nullable=True)
    model = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
