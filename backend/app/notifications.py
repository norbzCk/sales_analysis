from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.auth import get_current_user
from backend.app.notification_service import (
    list_notifications_for_subject,
    mark_notification_as_read,
    resolve_subject,
    serialize_notification,
    unread_count_for_subject,
)
from backend.database import get_db
from backend.models import Notification, User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


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

