from sqlalchemy import Boolean, Column, Date, DateTime, Float, Integer, String, func
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date)
    product = Column(String)
    category = Column(String)
    product_id = Column(Integer, nullable=True)
    quantity = Column(Integer)
    unit_price = Column(Float)
    status = Column(String, nullable=False, default="Pending")
    rating = Column(Integer, nullable=True)
    rated_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(Integer, nullable=True)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    stock = Column(Integer , nullable=False)
    description = Column(String)
    image_url = Column(String, nullable=True)
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
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
