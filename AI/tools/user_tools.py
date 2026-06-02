import os
from models import Users
from database import SessionLocal
from typing import Optional, List
from datetime import datetime, date
from langchain_core.tools import tool
from services.payment import handle_payment
from services.notification import create_notification
from services.cases import (
    get_users_cases,
    case_reopen,
    add_symptom_tc,
    add_documents_tc,
    close_the_case,
    remove_symptom_fc,
    remove_document_fc,
)
from services.appointments import (
    get_appointments,
    add_appointment,
    update_appointment_fc,
    cancel_appointment_fc,
)
from services.symptoms import (
    get_symptoms,
    add_symptom,
    update_symptom_fc,
    delete_symptom_fc,
)
from services.document_handling import get_hospital_policy
from services.profile import user_profile, update_user_profile
from utils.distance_user_hospital import find_n_nearby_doctors
from services.wallet import show_user_transactions, change_note
from services.doctor_service import get_all_doctors, get_my_doctors, assign_doctor_to_user


@tool
async def get_user_profile(authenticated_user_id: int) -> dict:
    """
    Get the authenticated user's profile information.

    Args:
        authenticated_user_id: The ID of the authenticated user.
    """
    try:
        return await user_profile(authenticated_user_id, "user")
    except Exception as e:
        return {"error": str(e)}


@tool
async def update_profile(authenticated_user_id: int, username: Optional[str] = None, email: Optional[str] = None) -> dict:
    """
    Update the authenticated user's profile. Provide at least one of username or email.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        username: The new username. Don't send empty string.
        email: The new email address. Don't send empty string.
    """
    try:
        return await update_user_profile(authenticated_user_id, username, email)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_all_available_doctors(page: int = 1, limit: int = 20, doctor_name: Optional[str] = None, hospital_name: Optional[str] = None) -> dict:
    """
    Get a paginated list of all available doctors, optionally filtered by doctor name or hospital name.

    Args:
        page: Page number (starts at 1).
        limit: Max number of items to return.
        doctor_name: Filter doctors by name.
        hospital_name: Filter doctors by hospital name.
    """
    try:
        return await get_all_doctors(page, limit, doctor_name, hospital_name)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_users_doctors(authenticated_user_id: int, page: int = 1, limit: int = 20, doctor_name: Optional[str] = None, hospital_name: Optional[str] = None) -> dict:
    """
    Get a paginated list of doctors currently assigned to the authenticated user.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        page: Page number (starts at 1).
        limit: Max number of items to return.
        doctor_name: Filter assigned doctors by name.
        hospital_name: Filter assigned doctors by hospital name.
    """
    try:
        return await get_my_doctors(authenticated_user_id, page, limit, doctor_name, hospital_name)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_user_cases(
    authenticated_user_id: int,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 4,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    doctor_id: Optional[int] = None,
    case_id: Optional[int] = None
) -> dict:
    """
    Get cases for the authenticated user, optionally filtered by status, dates, doctor ID, or case ID.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        status: Case status (e.g., 'OPEN', 'CLOSED').
        page: Page number (starts at 1).
        limit: Max number of cases to return (default 4).
        from_date: Filter cases from this date (e.g. YYYY-MM-DD or ISO string).
        to_date: Filter cases up to this date (e.g. YYYY-MM-DD or ISO string).
        doctor_id: Filter by a specific doctor ID.
        case_id: Filter by a specific case ID.
    """
    try:
        return await get_users_cases(authenticated_user_id, status, page, limit, from_date, to_date, doctor_id, case_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_user_appointments(
    authenticated_user_id: int,
    authenticated_user_type: str,
    status: Optional[str] = None,
    date_val: Optional[datetime] = None,
    page: int = 1,
    limit: int = 20
) -> dict:
    """
    Get a list of appointments for the authenticated user.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        authenticated_user_type: The role/type of the user.
        status: Optional status to filter (e.g., 'BOOKED', 'CANCELLED').
        date_val: Optional date to filter appointments (YYYY-MM-DD or ISO format).
        page: Page number (starts at 1).
        limit: Max number of items to return.
    """
    try:
        return await get_appointments(authenticated_user_id, authenticated_user_type, page, limit, status, date_val)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_user_symptoms(
    authenticated_user_id: int,
    date_val: Optional[date] = None,
    page: int = 1,
    limit: int = 20
) -> dict:
    """
    Get symptoms logged by the authenticated user.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        date_val: Optional date to filter symptoms (YYYY-MM-DD).
        page: Page number (starts at 1).
        limit: Max number of symptoms to return.
    """
    try:
        return await get_symptoms(authenticated_user_id, page, limit, date_val)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_nearby_doctors(
    authenticated_user_id: int,
    n: int
) -> dict:
    """
    Find N nearby doctors based on the user's current location.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        n: Number of nearby doctors to find.
    """
    try:
        results = await find_n_nearby_doctors(authenticated_user_id, n)
        return {
            "status" : "success",
            "message" : "Nearby doctors found successfully",
            "data" : results
        }
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_user_location(
    authenticated_user_id: int
) -> dict:
    """
    Get the current latitude and longitude location of the authenticated user.

    Args:
        authenticated_user_id: The ID of the authenticated user.
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        return {
            "user_id" : user.id,
            "latitude" : user.lat,
            "longitude" : user.lon,
            "has_location" : user.lat is not None and user.lon is not None
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def get_user_transactions(
    authenticated_user_id: int,
    type: Optional[str] = None,
    date_val: Optional[date] = None,
    page: int = 1,
    limit: int = 20
) -> dict:
    """
    Get the transaction history of the authenticated user.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        type: Filter by transaction type (e.g., 'INCOMING', 'OUTGOING', 'TOP-UP').
        date_val: Filter by transaction date (YYYY-MM-DD).
        page: Page number (starts at 1).
        limit: Max transactions to return.
    """
    try:
        return await show_user_transactions(authenticated_user_id, page, limit, type, date_val)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_hospital_policy_details(
    authenticated_user_id: int,
    authenticated_user_type: str,
    hospital_id: Optional[int] = None
) -> dict:
    """
    Get policy details for a hospital.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        authenticated_user_type: The role/type of the user.
        hospital_id: Optional hospital ID. If not provided, returns default policy details.
    """
    try:
        return await get_hospital_policy(authenticated_user_id, authenticated_user_type, hospital_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def add_user_symptom(
    authenticated_user_id: int,
    symptom: str,
    severity: int,
    case_id: Optional[int] = None
) -> dict:
    """
    Log a new symptom for the authenticated user, optionally attaching it to an open case.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        symptom: Description of the symptom (e.g. 'fever').
        severity: Severity rating of the symptom (0 to 10).
        case_id: Optional case ID to attach this symptom to.
    """
    try:
        return await add_symptom(symptom, severity, authenticated_user_id, case_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def assign_doctor(
    authenticated_user_id: int,
    doctor_id: int
) -> dict:
    """
    Assign a doctor to the authenticated user and create a case.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        doctor_id: The ID of the doctor to assign.
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        return await assign_doctor_to_user(doctor_id, user.id, user.role, user.name)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def book_appointment(
    authenticated_user_id: int,
    doctor_id: int,
    date_val: datetime
) -> dict:
    """
    Book an appointment with a doctor.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        doctor_id: The ID of the doctor.
        date_val: Proposed appointment date/time (ISO format or YYYY-MM-DD HH:MM:SS in the future).
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        return await add_appointment(user.id, user.role, user.name, doctor_id, date_val)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def upgrade_user(
    authenticated_user_id: int
) -> dict:
    """
    Upgrade the authenticated user's plan to PREMIUM. This initiates payment and registers premium access.

    Args:
        authenticated_user_id: The ID of the authenticated user.
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}

        premium_fees = os.getenv("PRIMIUM_PLAN_FEES")
        result = await handle_payment(
            user.id,
            user.role,
            1,
            "admin",
            premium_fees,
            note="Buying PREMIUM PLAN",
            type="OUTGOING"
        )

        await create_notification(
            message="You have been successfully upgraded to PREMIUM PLAN user",
            recipient_id=user.id,
            recipient_role="user"
        )

        return result
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def reopen_user_case(
    authenticated_user_id: int,
    case_id: int
) -> dict:
    """
    Reopen a closed case for the authenticated user.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        case_id: The ID of the case to reopen.
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        return await case_reopen(case_id, user.id, user.role, user.name)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def add_symptoms_to_case(
    authenticated_user_id: int,
    case_id: int,
    symptom_ids: List[int]
) -> dict:
    """
    Add a list of symptom IDs to a specific case.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        case_id: The case ID.
        symptom_ids: List of symptom IDs to add.
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        return await add_symptom_tc(case_id, user.id, user.name, symptom_ids)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def add_documents_to_case(
    authenticated_user_id: int,
    case_id: int,
    document_ids: List[int]
) -> dict:
    """
    Add a list of document IDs to a specific case.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        case_id: The case ID.
        document_ids: List of document IDs to add.
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        return await add_documents_tc(case_id, user.id, user.name, document_ids)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def close_case(
    authenticated_user_id: int,
    case_id: int
) -> dict:
    """
    Close an active case for the authenticated user.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        case_id: The case ID.
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        return await close_the_case(case_id, user.id, user.name, user.role)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def update_symptom(
    authenticated_user_id: int,
    symptom_id: int,
    symptom: str,
    severity: int
) -> dict:
    """
    Update logged symptom description and/or severity.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        symptom_id: The symptom ID to update.
        symptom: Updated symptom description.
        severity: Updated severity rating (0 to 10).
    """
    try:
        return await update_symptom_fc(symptom_id, symptom, severity, authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def update_appointment(
    authenticated_user_id: int,
    appointment_id: int,
    date_val: datetime
) -> dict:
    """
    Update/reschedule an existing appointment date and time.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        appointment_id: The appointment ID.
        date_val: Proposed new date/time (ISO format or YYYY-MM-DD HH:MM:SS in the future).
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        return await update_appointment_fc(appointment_id, user.id, user.name, user.role, date_val)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def update_user_location(
    authenticated_user_id: int,
    latitude: float,
    longitude: float
) -> dict:
    """
    Update the location of the authenticated user with new latitude and longitude.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        latitude: New latitude (-90 to 90).
        longitude: New longitude (-180 to 180).
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        user.lat = latitude
        user.lon = longitude
        db.commit()
        db.refresh(user)
        return {
            "message": "Location updated successfully",
            "user_id": user.id,
            "latitude": float(user.lat) if user.lat else None,
            "longitude": float(user.lon) if user.lon else None
        }
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def change_transaction_note(
    authenticated_user_id: int,
    transaction_id: int,
    note: str
) -> dict:
    """
    Change the descriptive note of an existing transaction.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        transaction_id: The ID of the transaction.
        note: New note text.
    """
    try:
        return await change_note(transaction_id, note, authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def remove_symptom_from_case(
    authenticated_user_id: int,
    case_id: int,
    symptom_id: int
) -> dict:
    """
    Remove a specific symptom from an existing case.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        case_id: The case ID.
        symptom_id: The symptom ID to remove.
    """
    try:
        return await remove_symptom_fc(case_id, symptom_id, authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def remove_document_from_case(
    authenticated_user_id: int,
    case_id: int,
    document_id: int
) -> dict:
    """
    Remove a document from a specific case.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        case_id: The case ID.
        document_id: The document ID to remove.
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        return await remove_document_fc(case_id, document_id, user.id, user.name, user.role)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def delete_symptom(
    authenticated_user_id: int,
    symptom_id: int,
    force: bool = False
) -> dict:
    """
    Delete a symptom logged by the authenticated user.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        symptom_id: The symptom ID to delete.
        force: Set to True to force delete even if attached to open cases.
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        return await delete_symptom_fc(symptom_id, user.id, user.name, force)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def cancel_appointment(
    authenticated_user_id: int,
    appointment_id: int
) -> dict:
    """
    Cancel an existing appointment.

    Args:
        authenticated_user_id: The ID of the authenticated user.
        appointment_id: The ID of the appointment to cancel.
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        return await cancel_appointment_fc(appointment_id, user.id, user.name, user.role)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def remove_location(
    authenticated_user_id: int
) -> dict:
    """
    Remove location data (latitude/longitude) for the authenticated user.

    Args:
        authenticated_user_id: The ID of the authenticated user.
    """
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.id == authenticated_user_id).first()
        if not user:
            return {"error": "User not found"}
        user.lat = None
        user.lon = None
        db.commit()
        return {
            "note": "Location removed successfully",
            "status": "success"
        }
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


user_tools = [
    get_user_profile,
    update_profile,
    get_all_available_doctors,
    get_users_doctors,
    get_user_cases,
    get_user_appointments,
    get_user_symptoms,
    get_nearby_doctors,
    get_user_location,
    get_user_transactions,
    get_hospital_policy_details,
    add_user_symptom,
    assign_doctor,
    book_appointment,
    upgrade_user,
    reopen_user_case,
    add_symptoms_to_case,
    add_documents_to_case,
    close_case,
    update_symptom,
    update_appointment,
    update_user_location,
    change_transaction_note,
    remove_symptom_from_case,
    remove_document_from_case,
    delete_symptom,
    cancel_appointment,
    remove_location
]
