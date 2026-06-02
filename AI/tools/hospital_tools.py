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
        authenticated_user_id: The ID of the authenticated hospital.
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
        authenticated_user_id: The ID of the authenticated hospital.
        page: Page number (starts at 1).
        limit: Max doctors to return.
        rating: Optional rating to filter.
        email: Optional email to filter.
        speciality: Optional specialty to filter.
        name: Optional doctor name to filter.
        availability: Optional availability status to filter.
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
        authenticated_user_id: The ID of the authenticated hospital.
        page: Page number (starts at 1).
        limit: Max users to return.
        status: Optional status to filter.
        user_name: Optional user name filter.
        doctor_name: Optional doctor name filter.
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
        authenticated_user_id: The ID of the authenticated hospital.
        status: Optional status filter.
        from_date: Filter cases from this date (e.g. YYYY-MM-DD or ISO string).
        to_date: Filter cases up to this date (e.g. YYYY-MM-DD or ISO string).
        doctor_id: Filter by a specific doctor's ID.
        case_id: Filter by a specific case ID.
        page: Page number (starts at 1).
        limit: Max cases to return.
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
        authenticated_user_id: The ID of the authenticated hospital.
        page: Page number (starts at 1).
        limit: Max doctors to return.
        doctor_name: Optional doctor name filter.
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
        authenticated_user_id: The ID of the authenticated hospital.
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
        authenticated_user_id: The ID of the authenticated hospital.
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
        authenticated_user_id: The ID of the authenticated hospital.
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
        authenticated_user_id: The ID of the authenticated hospital.
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
        authenticated_user_id: The ID of the authenticated hospital.
        type: Optional filter by transaction type.
        date_val: Optional date to filter.
        page: Page number (starts at 1).
        limit: Max transactions to return.
        doctor_name: Optional doctor name filter.
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
        authenticated_user_id: The ID of the authenticated hospital.
        username: The new username.
        email: The new email address.
        address: New address.
        city: New city.
        state: New state.
        zip_code: New ZIP code.
        phone_number: New phone number.
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
        authenticated_user_id: The ID of the authenticated hospital.
        charges: Percentage of fee deduction/charges (0 to 50).
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
        authenticated_user_id: The ID of the authenticated hospital.
        doctor_id: The ID of the doctor.
        availability: True for available, False for unavailable.
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
    Set/modify the active active cases limit for a doctor registered under the hospital.

    Args:
        authenticated_user_id: The ID of the authenticated hospital.
        doctor_id: The ID of the doctor.
        limit: Case limit integer.
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
