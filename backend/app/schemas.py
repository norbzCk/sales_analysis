from typing import Optional
from pydantic import BaseModel

class ProductCreate(BaseModel):
    id : int
    name: str
    category: str
    price: float
    stock: int
    description: Optional[str] = None