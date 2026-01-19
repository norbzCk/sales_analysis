from database import engine
from models import Base

Base.metadata.create_all(bind=engine)
print("Database tables created successfully.")


from sqlalchemy.orm import Session
from datetime import date
from models import Sale

session = Session(bind=engine)


if session.query(Sale).count() == 0:
    sample_sales = [
        Sale(date=date(2026, 1, 1), product="Laptop", category="Electronics", quantity=2, unit_price=1200),
        Sale(date=date(2026, 1, 1), product="Mouse", category="Electronics", quantity=5, unit_price=20),
        Sale(date=date(2026, 1, 2), product="Laptop", category="Electronics", quantity=1, unit_price=1200),
        Sale(date=date(2026, 1, 2), product="Keyboard", category="Electronics", quantity=3, unit_price=50),
    ]
    session.add_all(sample_sales)
    session.commit()
    print("Sample data inserted.")
else:
    print("Table already has data, skipping seeding.")

session.close()

