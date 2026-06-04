from typing import Optional
from models import Hospitals
from datetime import datetime
from database import SessionLocal
from langchain_core.tools import tool
from services.cases import get_hospitals_cases
from services.user_service import get_all_users_for_hospital
from services.wallet import show_doctor_transactions_for_hospital
from services.appointments import get_all_appointments_for_hospital
from services.profile import hospital_profile, update_hospital_profile
from services.document_handling import get_hospital_policy_for_hospital
from services.availibility import set_availibility_for_doctor, set_limit_for_doctor
from services.doctor_service import get_all_doctors_for_hospital, get_doctor_fees_for_hospital, get_doctors_balance_for_hospital

@tool
async def get_hospital_profile(authenticated_user_id: int) -> dict:
    """
    Get the authenticated hospital's profile details.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
    """
    try:
        return await hospital_profile(authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_hospital_doctors(
    authenticated_user_id: int,
    page: int = 1,
    limit: int = 20,
    rating: Optional[int] = None,
    email: Optional[str] = None,
    speciality: Optional[str] = None,
    name: Optional[str] = None,
    availability: Optional[bool] = None
) -> dict:
    """
    Get doctors registered under the authenticated hospital.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
        page (int): Page number for pagination (starts at 1).
        limit (int): Max doctors to return.
        rating (int, optional): Optional minimum rating to filter (integer, e.g. 1 to 5).
        email (str, optional): Optional email address to filter.
        speciality (str, optional): Optional specialty description string to filter (e.g., 'Cardiology').
        name (str, optional): Optional doctor name string to filter.
        availability (bool, optional): Optional availability status boolean to filter.
    """
    try:
        return await get_all_doctors_for_hospital(authenticated_user_id, page, limit, rating, email, speciality, name, availability)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_hospital_users(
    authenticated_user_id: int,
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    user_name: Optional[str] = None,
    doctor_name: Optional[str] = None
) -> dict:
    """
    Get users linked to/visiting the authenticated hospital.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
        page (int): Page number for pagination (starts at 1).
        limit (int): Max users to return.
        status (str, optional): Optional status to filter.
        user_name (str, optional): Optional user/patient name filter.
        doctor_name (str, optional): Optional doctor name filter.
    """
    try:
        return await get_all_users_for_hospital(authenticated_user_id, page, limit, status, user_name, doctor_name)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_hospital_cases(
    authenticated_user_id: int,
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    doctor_id: Optional[int] = None,
    case_id: Optional[int] = None,
    page: int = 1,
    limit: int = 20
) -> dict:
    """
    Get cases handled by the authenticated hospital, with optional filters.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
        status (str, optional): Optional status filter (e.g., 'OPEN', 'CLOSED').
        from_date (str, optional): Optional filter to return cases created on or after this date. MUST be an ISO 8601 string format (e.g., 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS').
        to_date (str, optional): Optional filter to return cases created on or before this date. MUST be an ISO 8601 string format (e.g., 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS').
        doctor_id (int, optional): Optional filter by a specific doctor's ID. To find a doctor ID, call `get_hospital_doctors` first.
        case_id (int, optional): Optional filter by a specific case ID. To find a case ID, call `get_hospital_cases` without filters first.
        page (int): Page number for pagination (starts at 1).
        limit (int): Max cases to return.
    """
    try:
        return await get_hospitals_cases(authenticated_user_id, status, from_date, to_date, doctor_id, case_id, page, limit)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_doctors_balance(
    authenticated_user_id: int,
    page: int = 1,
    limit: int = 20,
    doctor_name: Optional[str] = None
) -> dict:
    """
    Get current wallets balance of doctors registered under the authenticated hospital.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
        page (int): Page number for pagination (starts at 1).
        limit (int): Max doctors to return.
        doctor_name (str, optional): Optional doctor name filter.
    """
    try:
        return await get_doctors_balance_for_hospital(authenticated_user_id, page, limit, doctor_name)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_doctor_fees(authenticated_user_id: int) -> dict:
    """
    Get the fees breakdown for doctors in the authenticated hospital.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
    """
    try:
        return await get_doctor_fees_for_hospital(authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_hospital_location(authenticated_user_id: int) -> dict:
    """
    Get the geographic coordinates (latitude and longitude) of the authenticated hospital.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
    """
    db = SessionLocal()
    try:
        hospital = db.query(Hospitals).filter(Hospitals.id == authenticated_user_id).first()
        if not hospital:
            return {"error": "Hospital not found"}
        return {"latitude": hospital.lat, "longitude": hospital.lon}
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def get_hospital_appointments(authenticated_user_id: int) -> dict:
    """
    Get all appointments registered under the authenticated hospital.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
    """
    try:
        return await get_all_appointments_for_hospital(authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_hospital_policy_details_hospital(authenticated_user_id: int) -> dict:
    """
    Get the upload policy and signed URL access details for the authenticated hospital.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
    """
    try:
        return await get_hospital_policy_for_hospital(authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def show_doctor_transactions(
    authenticated_user_id: int,
    type: Optional[str] = None,
    date_val: Optional[datetime] = None,
    page: int = 1,
    limit: int = 20,
    doctor_name: Optional[str] = None
) -> dict:
    """
    Show transaction history of doctors registered under the authenticated hospital.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
        type (str, optional): Optional filter by transaction type.
        date_val (str, optional): Optional filter by transaction date. MUST be an ISO 8601 string format (e.g. 'YYYY-MM-DD').
        page (int): Page number for pagination (starts at 1).
        limit (int): Max transactions to return.
        doctor_name (str, optional): Optional doctor name string to filter transactions by.
    """
    try:
        return await show_doctor_transactions_for_hospital(authenticated_user_id, page, limit, type, date_val, doctor_name)
    except Exception as e:
        return {"error": str(e)}


@tool
async def update_hospital_profile_details(
    authenticated_user_id: int,
    username: Optional[str] = None,
    email: Optional[str] = None,
    address: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    zip_code: Optional[str] = None,
    phone_number: Optional[str] = None
) -> dict:
    """
    Update the authenticated hospital's profile details.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
        username (str, optional): Optional new username string.
        email (str, optional): Optional new email address string.
        address (str, optional): Optional new address string.
        city (str, optional): Optional new city string.
        state (str, optional): Optional new state string.
        zip_code (str, optional): Optional new ZIP code string.
        phone_number (str, optional): Optional new phone number string.
    """
    try:
        return await update_hospital_profile(username, email, address, city, state, zip_code, phone_number, authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def update_charges(
    authenticated_user_id: int,
    charges: float
) -> dict:
    """
    Update commission charges rate (percentage) of the hospital. Max 50%.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
        charges (float): Percentage of fee deduction/charges (float value between 0.0 and 50.0).
    """
    if charges > 50:
        return {"error": "Hospitals can not take charges more than 50%"}
    if charges < 0:
        return {"error": "Charges can not be negative"}

    db = SessionLocal()
    try:
        hos = db.query(Hospitals).filter(Hospitals.id == authenticated_user_id).first()
        if not hos:
            return {"error": "Hospital not found"}
        hos.charges = charges * 0.01
        db.commit()
        db.refresh(hos)
        return {
            "note": "Charges updated successfully",
            "charges": hos.charges
        }
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def change_availibility_of_doctor(
    authenticated_user_id: int,
    doctor_id: int,
    availability: bool
) -> dict:
    """
    Modify/set the availability status of a practicing doctor registered under the hospital.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
        doctor_id (int): The ID of the doctor to update availability for. To find doctor IDs registered under this hospital, first call `get_hospital_doctors`.
        availability (bool): True for available, False for unavailable.
    """
    db = SessionLocal()
    try:
        hospital = db.query(Hospitals).filter(Hospitals.id == authenticated_user_id).first()
        if not hospital:
            return {"error": "Hospital not found"}
        return await set_availibility_for_doctor(doctor_id, hospital.name, availability)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def change_case_limit(
    authenticated_user_id: int,
    doctor_id: int,
    limit: int
) -> dict:
    """
    Set/modify the active cases limit for a doctor registered under the hospital.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated hospital. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 3', pass 3).
        doctor_id (int): The ID of the doctor to update case limit for. To find doctor IDs registered under this hospital, first call `get_hospital_doctors`.
        limit (int): Case limit (positive integer).
    """
    db = SessionLocal()
    try:
        hospital = db.query(Hospitals).filter(Hospitals.id == authenticated_user_id).first()
        if not hospital:
            return {"error": "Hospital not found"}
        return await set_limit_for_doctor(doctor_id, hospital.name, limit)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


hospital_tools = [
    get_hospital_profile,
    get_hospital_doctors,
    get_hospital_users,
    get_hospital_cases,
    get_doctors_balance,
    get_doctor_fees,
    get_hospital_location,
    get_hospital_appointments,
    get_hospital_policy_details_hospital,
    show_doctor_transactions,
    update_hospital_profile_details,
    update_charges,
    change_availibility_of_doctor,
    change_case_limit,
]
