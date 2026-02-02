#This defines the schema for creating a new product, you only pass what is needed to be created(product by user)(not the id, it made bugs here)
#pydantic checks for correct data types and required fields
from pydantic import BaseModel

class ProductCreate(BaseModel):
    name: str
    category: str
    price: float
    stock: int
    description: str

class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: str | None = None
    location: str | None = None

class CustomerResponse(CustomerCreate):
    id: int

    class Config:
        orm_mode = True