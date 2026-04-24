import json
import logging
from typing import Dict, List, Set

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from backend.app.auth import get_current_user, get_user_from_token
from backend.app.notification_service import (
    list_notifications_for_subject,
    mark_notification_as_read,
    resolve_subject,
    serialize_notification,
    unread_count_for_subject,
)
from backend.database import get_db, SessionLocal
from backend.models import Notification, User, DeliveryOrder, Sale

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# --- Real-time WebSocket Manager ---

class ConnectionManager:
    def __init__(self):
        # order_id -> set of active websockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, order_id: int):
        await websocket.accept()
        if order_id not in self.active_connections:
            self.active_connections[order_id] = set()
        self.active_connections[order_id].add(websocket)

    def disconnect(self, websocket: WebSocket, order_id: int):
        if order_id in self.active_connections:
            self.active_connections[order_id].remove(websocket)
            if not self.active_connections[order_id]:
                del self.active_connections[order_id]

    async def broadcast_to_order(self, order_id: int, message: dict):
        if order_id in self.active_connections:
            # Create a list to iterate over to avoid "Set size changed during iteration" errors
            targets = list(self.active_connections[order_id])
            for connection in targets:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Connection might be dead
                    self.disconnect(connection, order_id)

manager = ConnectionManager()

# --- WebSocket Endpoint ---

@router.websocket("/ws/delivery/{order_id}")
async def delivery_websocket(websocket: WebSocket, order_id: int, token: str = None):
    """
    WebSocket for live chat and location tracking.
    Usage: ws://host/notifications/ws/delivery/123?token=XYZ
    """
    # 1. Validate User from Token
    user = None
    if token:
        user = get_user_from_token(token)
    
    if not user:
        await websocket.close(code=1008) # Policy Violation
        return

    # 2. Check Permission (Is user the buyer or the assigned rider?)
    db = SessionLocal()
    try:
        delivery = db.query(DeliveryOrder).filter(DeliveryOrder.order_id == order_id).first()
        sale = db.query(Sale).filter(Sale.id == order_id).first()
        
        if not sale:
            await websocket.close(code=1007) # Invalid Data
            return
            
        buyer_id = getattr(sale, "buyer_id", None) or getattr(sale, "created_by", None) or getattr(delivery, "buyer_id", None)
        is_buyer = buyer_id == user.id and user.role == "user"
        is_rider = delivery and delivery.logistics_id == user.id and user.role == "logistics"
        
        # Only buyer or rider can join
        if not (is_buyer or is_rider):
            await websocket.close(code=1008)
            return

        await manager.connect(websocket, order_id)
        
        # Notify others that someone joined
        await manager.broadcast_to_order(order_id, {
            "type": "presence",
            "user": user.name,
            "role": user.role,
            "status": "online"
        })

        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle Message Types
                msg_type = message.get("type")
                
                if msg_type == "chat":
                    # Broadcast chat message to everyone in the order
                    await manager.broadcast_to_order(order_id, {
                        "type": "chat",
                        "sender_id": user.id,
                        "sender_name": user.name,
                        "sender_role": user.role,
                        "text": message.get("text"),
                        "timestamp": message.get("timestamp")
                    })
                
                elif msg_type == "location" and user.role == "logistics":
                    # Rider sending their live location
                    lat = message.get("lat")
                    lng = message.get("lng")
                    
                    if lat and lng:
                        # Update DB for persistence
                        if delivery:
                            delivery.current_lat = lat
                            delivery.current_lng = lng
                            db.add(delivery)
                            db.commit()
                        
                        # Broadcast location to the buyer
                        await manager.broadcast_to_order(order_id, {
                            "type": "location",
                            "lat": lat,
                            "lng": lng,
                            "rider_name": user.name
                        })

        except WebSocketDisconnect:
            manager.disconnect(websocket, order_id)
            await manager.broadcast_to_order(order_id, {
                "type": "presence",
                "user": user.name,
                "role": user.role,
                "status": "offline"
            })
    finally:
        db.close()

# --- Standard Notification Routes ---

@router.get("/")
def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    recipient_type, recipient_id, _, _ = resolve_subject(current)
    items = list_notifications_for_subject(db, recipient_type, recipient_id, limit=limit, unread_only=unread_only)
    return {
        "items": [serialize_notification(item) for item in items],
        "unread_count": unread_count_for_subject(db, recipient_type, recipient_id),
    }


@router.get("/summary")
def get_notification_summary(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    recipient_type, recipient_id, _, _ = resolve_subject(current)
    return {"unread_count": unread_count_for_subject(db, recipient_type, recipient_id)}


@router.post("/{notification_id}/read")
def read_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    recipient_type, recipient_id, _, _ = resolve_subject(current)
    item = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.recipient_type == recipient_type,
            Notification.recipient_id == recipient_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")

    mark_notification_as_read(db, item)
    db.commit()
    db.refresh(item)
    return {"item": serialize_notification(item)}


@router.post("/read-all")
def read_all_notifications(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    recipient_type, recipient_id, _, _ = resolve_subject(current)
    items = list_notifications_for_subject(db, recipient_type, recipient_id, limit=100, unread_only=True)
    for item in items:
        mark_notification_as_read(db, item)
    db.commit()
    return {"updated": len(items)}
