from sqlalchemy import Column, Integer, String, Date, Float
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True)
    date = Column(Date)
    product = Column(String)
    category = Column(String)
    quantity = Column(Integer)
    unit_price = Column(Float)

