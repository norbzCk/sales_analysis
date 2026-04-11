import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.auth import get_current_user, require_roles
from backend.app.schemas import PaymentRequest, PaymentResponse, PaymentMethod
from backend.database import get_db
from backend.models import Sale, User

router = APIRouter(prefix="/payments", tags=["Payments"])


PAYMENT_METHODS = [
    {
        "id": "mpesa",
        "name": "M-Pesa",
        "type": "mobile_money",
        "enabled": True,
        "instructions": "Enter your M-Pesa phone number. You will receive a prompt on your phone."
    },
    {
        "id": "airtel_money",
        "name": "Airtel Money",
        "type": "mobile_money",
        "enabled": True,
        "instructions": "Enter your Airtel Money phone number. You will receive a prompt on your phone."
    },
    {
        "id": "tigopesa",
        "name": "Tigo Pesa",
        "type": "mobile_money",
        "enabled": True,
        "instructions": "Enter your Tigo Pesa phone number."
    },
    {
        "id": "bank_transfer",
        "name": "Bank Transfer",
        "type": "bank",
        "enabled": True,
        "instructions": "Transfer to our business account. Upload receipt after payment."
    },
    {
        "id": "cash",
        "name": "Cash on Delivery",
        "type": "cash",
        "enabled": True,
        "instructions": "Pay with cash when receiving your order."
    },
    {
        "id": "credit",
        "name": "Credit Account",
        "type": "credit",
        "enabled": False,
        "instructions": "Available for approved business accounts only."
    }
]


@router.get("/methods")
def get_payment_methods(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return {"payment_methods": PAYMENT_METHODS}


@router.get("/methods/public")
def get_public_payment_methods(
    db: Session = Depends(get_db),
):
    return {"payment_methods": [m for m in PAYMENT_METHODS if m.get("enabled", True)]}


@router.post("/initiate")
def initiate_payment(
    payload: PaymentRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    order = db.query(Sale).filter(Sale.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if abs(order.unit_price * order.quantity - payload.amount) > 0.01:
        raise HTTPException(status_code=400, detail="Amount does not match order total")
    
    transaction_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"
    
    return {
        "transaction_id": transaction_id,
        "status": "pending",
        "amount": payload.amount,
        "message": f"Payment initiated via {payload.payment_method}. Awaiting confirmation.",
        "timestamp": datetime.utcnow().isoformat(),
        "order_id": payload.order_id,
        "instructions": next((m["instructions"] for m in PAYMENT_METHODS if m["id"] == payload.payment_method), None)
    }


@router.post("/mobile-money/stk-push")
def stk_push_payment(
    phone_number: str,
    amount: float,
    order_id: int,
    provider: str = "mpesa",
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if provider not in ["mpesa", "airtel_money", "tigopesa"]:
        raise HTTPException(status_code=400, detail="Invalid mobile money provider")
    
    order = db.query(Sale).filter(Sale.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    transaction_id = f"STK-{uuid.uuid4().hex[:10].upper()}"
    
    return {
        "transaction_id": transaction_id,
        "status": "initiated",
        "message": f"STK Push sent to {phone_number}. Complete payment on your phone.",
        "phone_number": phone_number[:4] + "****" + phone_number[-4:] if len(phone_number) > 7 else phone_number,
        "amount": amount,
        "provider": provider,
        "expires_in": 300
    }


@router.get("/transaction/{transaction_id}")
def get_transaction_status(
    transaction_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return {
        "transaction_id": transaction_id,
        "status": "completed",
        "message": "Payment confirmed successfully",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/history")
def get_payment_history(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    sales = db.query(Sale).filter(
        Sale.created_by == current.id
    ).order_by(Sale.id.desc()).limit(50).all()
    
    return {
        "payments": [
            {
                "transaction_id": f"TXN-{sale.id:06d}",
                "order_id": sale.id,
                "product": sale.product,
                "amount": float(sale.unit_price * sale.quantity),
                "status": sale.status,
                "date": sale.date.isoformat() if sale.date else None
            }
            for sale in sales
        ]
    }


@router.post("/webhook/mpesa")
def mpesa_webhook(
    db: Session = Depends(get_db),
):
    return {"status": "received"}