from typing import Optional
from models import Notifications
from fastapi import HTTPException
from database import SessionLocal
from sqlalchemy.orm import Session
from utils.dependencies import db_dependency

async def my_notfications(db: Session, user_id: int, role: str):
    # Return ALL notifications with created_at, newest first
    notifications = db.query(Notifications).filter(
        Notifications.user_id == user_id,
        Notifications.role == role
    ).order_by(Notifications.id.desc()).all()
    
    # Convert to dict with ISO format date
    return [
        {
            "id": n.id,
            "user_id": n.user_id,
            "role": n.role,
            "message": n.message,
            "read": n.read,
            "created_at": n.created_at.isoformat() if n.created_at else None
        }
        for n in notifications
    ]

async def mark_notifications_as_read(db: Session, user_id: int, role: str, notification_id: Optional[int] = None):
    notific = db.query(Notifications).filter(Notifications.user_id == user_id, Notifications.role == role)
    if notification_id is not None:
        notific = notific.filter(Notifications.id == notification_id)
        
    notifications = notific.all()
    if not notifications:
        raise HTTPException(status_code = 404, detail = "Notification not found")
    
    updated_count = 0
    for notification in notifications:
        # Verify ownership
        if notification.user_id != user_id or notification.role != role:
            raise HTTPException(status_code = 401, detail = "Unauthorized access to this notification")
        # Only update if not already read (no error if already read)
        if not notification.read:
            notification.read = True
            updated_count += 1

    db.commit()
    return {
        "message": f"{updated_count} Notification(s) marked as read",
        "updated_count": updated_count
    }

async def create_notification(db: db_dependency, message: str, recipient_id: int, recipient_role: str):
    try:
        new_notification = Notifications(
            user_id=recipient_id,
            role=recipient_role,
            message=message,
            read=False
        )
        db.add(new_notification)
        db.commit()
        db.refresh(new_notification)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating notification: {e}")
    finally:
        db.close()

async def delete_notifications(db: Session, notification_id: int, user_id: int, role: str):
    notification = db.query(Notifications).filter(
        Notifications.id == notification_id,
        Notifications.user_id == user_id,
        Notifications.role == role
    ).first()
    if not notification:
        raise ValueError("Notification not found")
    db.delete(notification)
    db.commit()
    return {"message": "1 Notification deleted"}

async def delete_all_notification(db: Session, user_id: int, role: str):
    notifications = db.query(Notifications).filter(
        Notifications.user_id == user_id,
        Notifications.role == role
    ).all()
    if not notifications:
        raise ValueError("No notifications found")
    length = len(notifications)
    for notification in notifications:
        db.delete(notification)
    db.commit()
    return {"message": f"{length} Notification(s) deleted"}