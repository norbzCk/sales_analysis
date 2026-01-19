from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql://postgres:12345@localhost:5432/sales_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

