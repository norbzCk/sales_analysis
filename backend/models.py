from sqlalchemy import Column, Integer, String, Date, Float
from sqlalchemy.ext.declarative import declarative_base
from backend import models
from sqlalchemy.orm import relationship
from backend.database import engine
Base = declarative_base()
models.Base.metadata.create_all(bind=engine)
class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date)
    product = Column(String)
    category = Column(String)
    quantity = Column(Integer)
    unit_price = Column(Float)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    stock = Column(Integer , nullable=False)
    description = Column(String)

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=True)
    location = Column(String, nullable=True)

    sales = relationship("Sale", back_populates="customer")
