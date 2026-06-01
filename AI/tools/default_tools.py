import os
from typing import Optional
from langchain_core.tools import tool
from database import SessionLocal
from models import Users, Doctors, Hospitals
from services.profile import change_password
from services.wallet import my_wallet, top_up
from services.notification import create_notification, my_notfications, mark_notifications_as_read
from services.document_handling import get_document


def get_requester_info(db, user_id: int, user_type: str) -> Optional[dict]:
    # Query corresponding table depending on user_type (role)
    if user_type == "user":
        u = db.query(Users).filter(Users.id == user_id).first()
        if u:
            return {"id": u.id, "role": u.role, "type": "user", "name": u.name}
    elif user_type == "doctor":
        d = db.query(Doctors).filter(Doctors.id == user_id).first()
        if d:
            return {"id": d.id, "role": "doctor", "type": "doctor", "name": d.name}
    elif user_type == "hospital":
        h = db.query(Hospitals).filter(Hospitals.id == user_id).first()
        if h:
            return {"id": h.id, "role": "hospital", "type": "hospital", "name": h.name}
    elif user_type == "admin":
        u = db.query(Users).filter(Users.id == user_id).first()
        if u:
            return {"id": u.id, "role": "admin", "type": "admin", "name": u.name}
    return None


@tool
async def change_user_password(
    authenticated_user_id: int,
    authenticated_user_type: str,
    password: str
) -> dict:
    """
    Change the login password for the authenticated requester.

    Args:
        authenticated_user_id: The ID of the authenticated requester.
        authenticated_user_type: The role of the requester ('user', 'doctor', 'hospital', 'admin').
        password: The new login password.
    """
    db = SessionLocal()
    try:
        req_info = get_requester_info(db, authenticated_user_id, authenticated_user_type)
        if not req_info:
            return {"error": "Requester not found"}
        return await change_password(password, req_info["id"], req_info["role"])
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def top_up_wallet(
    authenticated_user_id: int,
    authenticated_user_type: str,
    amount: int
) -> dict:
    """
    Top up/add money to the authenticated requester's wallet balance.

    Args:
        authenticated_user_id: The ID of the authenticated requester.
        authenticated_user_type: The role of the requester ('user', 'doctor', 'hospital', 'admin').
        amount: Positive integer amount of money to top up.
    """
    if amount <= 0:
        return {"error": "Amount must be positive"}

    db = SessionLocal()
    try:
        req_info = get_requester_info(db, authenticated_user_id, authenticated_user_type)
        if not req_info:
            return {"error": "Requester not found"}
        return await top_up(amount, req_info["id"], req_info["role"], req_info["type"])
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def get_my_wallet(
    authenticated_user_id: int,
    authenticated_user_type: str
) -> dict:
    """
    Get the wallet balance and currency details for the authenticated requester.

    Args:
        authenticated_user_id: The ID of the authenticated requester.
        authenticated_user_type: The role of the requester ('user', 'doctor', 'hospital', 'admin').
    """
    db = SessionLocal()
    try:
        req_info = get_requester_info(db, authenticated_user_id, authenticated_user_type)
        if not req_info:
            return {"error": "Requester not found"}
        return await my_wallet(req_info["id"], req_info["role"])
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def get_documents(
    authenticated_user_id: int,
    authenticated_user_type: str,
    limit: int = 20,
    offset: int = 0,
    case_id: Optional[int] = None
) -> dict:
    """
    Get a list of documents uploaded/accessible by the authenticated requester.

    Args:
        authenticated_user_id: The ID of the authenticated requester.
        authenticated_user_type: The role of the requester ('user', 'doctor', 'hospital', 'admin').
        limit: Max documents to return.
        offset: Offset to start pagination.
        case_id: Optional case ID filter.
    """
    db = SessionLocal()
    try:
        req_info = get_requester_info(db, authenticated_user_id, authenticated_user_type)
        if not req_info:
            return {"error": "Requester not found"}
        return await get_document(req_info["id"], req_info["role"], limit, offset, case_id)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def get_notifications(
    authenticated_user_id: int,
    authenticated_user_type: str
) -> dict:
    """
    Get a list of all system notifications for the authenticated requester.

    Args:
        authenticated_user_id: The ID of the authenticated requester.
        authenticated_user_type: The role of the requester ('user', 'doctor', 'hospital', 'admin').
    """
    db = SessionLocal()
    try:
        req_info = get_requester_info(db, authenticated_user_id, authenticated_user_type)
        if not req_info:
            return {"error": "Requester not found"}
        notifications = await my_notfications(req_info["id"], req_info["role"])
        return {"notifications": notifications, "count": len(notifications)}
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def mark_notification_as_read(
    authenticated_user_id: int,
    authenticated_user_type: str,
    notification_id: Optional[int] = None
) -> dict:
    """
    Mark one specific notification or all notifications as read for the authenticated requester.

    Args:
        authenticated_user_id: The ID of the authenticated requester.
        authenticated_user_type: The role of the requester ('user', 'doctor', 'hospital', 'admin').
        notification_id: Optional notification ID to mark as read. If not provided, marks all as read.
    """
    db = SessionLocal()
    try:
        req_info = get_requester_info(db, authenticated_user_id, authenticated_user_type)
        if not req_info:
            return {"error": "Requester not found"}

        if notification_id:
            result = await mark_notifications_as_read(req_info["id"], req_info["role"], notification_id=notification_id)
        else:
            result = await mark_notifications_as_read(req_info["id"], req_info["role"])

        if result is None:
            return {"error": "Notification not found"}
        return result
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


default_tools = [
    change_user_password,
    top_up_wallet,
    get_my_wallet,
    get_documents,
    get_notifications,
    mark_notification_as_read
]
