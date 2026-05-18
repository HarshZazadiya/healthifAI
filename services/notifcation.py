from typing import Optional
from models import Notifications
from fastapi import HTTPException
from database import SessionLocal
from sqlalchemy.orm import Session
from utils.dependencies import db_dependency

async def my_notfications(db : Session, user_id : int, role : str):
    notifications = db.query(Notifications).filter(Notifications.user_id == user_id, Notifications.role == role, Notifications.read == False).all()
    return notifications

async def mark_notifications_as_read(db : Session, user_id : int, role : str, notification_id : Optional[int] = None):
    if notification_id:
        notific = db.query(Notifications).filter(Notifications.id == notification_id)
    else:
        notific = db.query(Notifications).filter(Notifications.user_id == user_id, Notifications.role == role)

    notifications = notific.all()
    if not notifications : 
        raise HTTPException(status_code = 404, detail = "Notification not found")
    for notification in notifications:
        if notification.read == True:
            raise HTTPException(status_code = 400, detail = "Notification already marked as read")
        if notification.user_id != user_id or notification.role != role:
            raise HTTPException(status_code = 401, detail = "Unauthorized access to this notification")
        notification.read = True

    db.commit()
    return {
        "message" : f"{len(notifications)} Notification marked as read"
    }
    

async def create_notification(db : db_dependency, message: str, recipient_id: int, recipient_role: str):
    try:
        new_notification = Notifications(
            user_id = recipient_id,
            role = recipient_role,
            message = message,
            read = False
        )
        db.add(new_notification)
        db.commit()
        db.refresh(new_notification)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code = 500, detail = f"Error creating notification: {e}")
    finally:
        db.close()

async def delete_notifications(db : Session, notification_id : int, user_id : int, role : str):
    notification = db.query(Notifications).filter(Notifications.id == notification_id, Notifications.user_id == user_id, Notifications.role == role).first()
    if not notification:
        raise ValueError("Notification not found")
    db.delete(notification)
    db.commit()

    return {"message" : f"1 Notification deleted"}

async def delete_all_notification(db : Session, user_id : int, role : str):
    notifications = db.query(Notifications).filter(Notifications.user_id == user_id, Notifications.role == role).all()
    if not notifications:
        raise ValueError("No notifications found")

    length = len(notifications)
    for notification in notifications:
        db.delete(notification)

    db.commit()

    return {"message" : f"{length} Notification deleted"}