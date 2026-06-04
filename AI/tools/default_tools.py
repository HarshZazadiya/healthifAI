import os
from typing import Optional
from database import SessionLocal
from services.wallet import my_wallet
from langchain_core.tools import tool
from models import Users, Doctors, Hospitals
from services.profile import change_password
from services.document_handling import get_document

from services.notification import my_notfications, mark_notifications_as_read

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
        authenticated_user_id (int): The ID of the currently authenticated requester. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 34', pass 34).
        authenticated_user_type (str): The role of the currently authenticated requester. You MUST extract this value from the system prompt's Current User role field (e.g. if the system prompt says 'role: user', pass 'user'). Accepted values are 'user', 'doctor', 'hospital', or 'admin'.
        password (str): The new login password. This must be a non-empty string.
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


# @tool
# async def top_up_wallet(
#     authenticated_user_id: int,
#     authenticated_user_type: str,
#     amount: int
# ) -> dict:
#     """
#     Top up/add money to the authenticated requester's wallet balance.

#     Args:
#         authenticated_user_id (int): The ID of the authenticated requester.
#         authenticated_user_type (str): The role of the requester ('user', 'doctor', 'hospital', 'admin').
#         amount (int): Positive integer amount of money to top up.
#     """
#     if amount <= 0:
#         return {"error": "Amount must be positive"}

#     db = SessionLocal()
#     try:
#         req_info = get_requester_info(db, authenticated_user_id, authenticated_user_type)
#         if not req_info:
#             return {"error": "Requester not found"}
#         return await top_up(amount, req_info["id"], req_info["role"], req_info["type"])
#     except Exception as e:
#         return {"error": str(e)}
#     finally:
#         db.close()


@tool
async def get_my_wallet(
    authenticated_user_id: int,
    authenticated_user_type: str
) -> dict:
    """
    Get the wallet balance and currency details for the authenticated requester.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated requester. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 34', pass 34).
        authenticated_user_type (str): The role of the currently authenticated requester. You MUST extract this value from the system prompt's Current User role field (e.g. if the system prompt says 'role: user', pass 'user'). Accepted values are 'user', 'doctor', 'hospital', or 'admin'.
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
    Get a paginated list of documents uploaded/accessible by the authenticated requester.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated requester. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 34', pass 34).
        authenticated_user_type (str): The role of the currently authenticated requester. You MUST extract this value from the system prompt's Current User role field (e.g. if the system prompt says 'role: user', pass 'user'). Accepted values are 'user', 'doctor', 'hospital', or 'admin'.
        limit (int): Max number of documents to return (integer, default is 20).
        offset (int): Offset to start pagination (integer, default is 0).
        case_id (int, optional): Optional case ID filter. If provided, returns documents associated only with this case. To obtain a valid case ID, you MUST first query the user's cases (e.g., using `get_user_cases`).
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
        authenticated_user_id (int): The ID of the currently authenticated requester. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 34', pass 34).
        authenticated_user_type (str): The role of the currently authenticated requester. You MUST extract this value from the system prompt's Current User role field (e.g. if the system prompt says 'role: user', pass 'user'). Accepted values are 'user', 'doctor', 'hospital', or 'admin'.
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
        authenticated_user_id (int): The ID of the currently authenticated requester. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 34', pass 34).
        authenticated_user_type (str): The role of the currently authenticated requester. You MUST extract this value from the system prompt's Current User role field (e.g. if the system prompt says 'role: user', pass 'user'). Accepted values are 'user', 'doctor', 'hospital', or 'admin'.
        notification_id (int, optional): Optional notification ID to mark as read. If not provided, marks all notifications as read. To obtain a valid notification ID, you MUST first retrieve the notifications (using `get_notifications`).
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


@tool
async def switch_dashboard_tab(
    tab_name: str
) -> dict:
    """
    Switch the dashboard active tab/view to a specific section to guide the user.
    Use this when the user asks to see a page, view their appointments, view documents, check their wallet, search for doctors, open chat, etc.
    
    Args:
        tab_name (str): The target tab identifier to navigate to. This MUST be a exact string match from the following lists based on the requester's role:
          - For 'user' (Patient): 'overview', 'cases', 'symptoms', 'appointments', 'doctors', 'myDoctors', 'documents', 'policies', 'wallet', 'location', 'chat', 'profile'
          - For 'doctor': 'overview', 'cases', 'appointments', 'assignedUsers' (Patients), 'fees', 'hospital', 'documents', 'policy', 'wallet', 'chat', 'profile'
          - For 'hospital': 'overview', 'appointments', 'doctors', 'users' (Patients), 'cases', 'wallet', 'policy', 'chat', 'profile'
          - For 'admin': 'users', 'doctors', 'hospitals', 'policies', 'cases', 'transactions', 'wallets', 'notifications', 'settings'
    """
    return {"status": "success", "message": f"Successfully switched dashboard tab to '{tab_name}'"}


default_tools = [
    change_user_password,
    # top_up_wallet,
    get_my_wallet,
    get_documents,
    get_notifications,
    mark_notification_as_read,
    switch_dashboard_tab
]

