from models import Doctors
from typing import Optional
from database import SessionLocal
from datetime import datetime, date
from langchain_core.tools import tool
from services.document_handling import get_hospital_policy
from services.wallet import change_note, show_doctor_transactions
from services.profile import doctor_profile, update_doctor_profile
from services.cases import close_the_case, get_doctors_cases, remove_document_fc
from services.appointments import cancel_appointment_fc, complete_appointment_fc, get_appointments
from services.doctor_service import get_assigned_users_of_doctor, get_doctors_under_same_hospital, get_hospital_details

@tool
async def get_doctor_profile(authenticated_user_id: int) -> dict:
    """
    Get the authenticated doctor's profile details.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
    """
    try:
        return await doctor_profile(authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_doctor_cases(
    authenticated_user_id: int,
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
    case_id: Optional[int] = None,
    page: int = 1,
    limit: int = 20
) -> dict:
    """
    Get cases assigned to the authenticated doctor, optionally filtered by status, dates, user ID, or case ID.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        status: Optional status to filter (e.g. 'OPEN', 'CLOSED').
        from_date: Filter cases from this date (e.g. YYYY-MM-DD or ISO string).
        to_date: Filter cases up to this date (e.g. YYYY-MM-DD or ISO string).
        user_id: Filter by a specific user's ID.
        case_id: Filter by a specific case ID.
        page: Page number (starts at 1).
        limit: Max cases to return.
    """
    try:
        return await get_doctors_cases(authenticated_user_id, status, from_date, to_date, user_id, case_id, page, limit)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_doctor_appointments(
    authenticated_user_id: int,
    date_val: Optional[date] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 10
) -> dict:
    """
    Get appointments for the authenticated doctor.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        date_val: Optional date (YYYY-MM-DD) to filter appointments.
        status: Optional status to filter (e.g. 'BOOKED', 'COMPLETED').
        page: Page number (starts at 1).
        limit: Max appointments to return.
    """
    try:
        return await get_appointments(authenticated_user_id, "doctor", page, limit, status, date_val)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_doctor_assigned_users(
    authenticated_user_id: int,
    user_name: Optional[str] = None,
    page: int = 1,
    limit: int = 10
) -> dict:
    """
    Get users assigned to the authenticated doctor.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        user_name: Optional user name filter.
        page: Page number (starts at 1).
        limit: Max users to return.
    """
    try:
        return await get_assigned_users_of_doctor(authenticated_user_id, page, limit, user_name)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_doctor_fees(authenticated_user_id: int) -> dict:
    """
    Get current consultation fees and appointment fees for the authenticated doctor.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
    """
    db = SessionLocal()
    try:
        doct = db.query(Doctors).filter(Doctors.id == authenticated_user_id).first()
        if not doct:
            return {"error": "Doctor not found"}
        return {
            "fees": doct.fees,
            "appointment_fees": doct.appointment_fees
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def get_doctor_hospital_details(authenticated_user_id: int) -> dict:
    """
    Get details of the hospital where the authenticated doctor is practicing.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
    """
    db = SessionLocal()
    try:
        doctor = db.query(Doctors).filter(Doctors.id == authenticated_user_id).first()
        if not doctor:
            return {"error": "Doctor not found"}
        return await get_hospital_details(doctor)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def get_doctors_under_same_hospital(authenticated_user_id: int) -> dict:
    """
    Get all doctors practicing under the same hospital as the authenticated doctor.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
    """
    try:
        return await get_doctors_under_same_hospital(authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_doctor_transactions(
    authenticated_user_id: int,
    type: Optional[str] = None,
    date_val: Optional[date] = None,
    page: int = 1,
    limit: int = 10
) -> dict:
    """
    Get transaction history for the authenticated doctor.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        type: Optional filter by transaction type (e.g. 'INCOMING', 'OUTGOING').
        date_val: Optional filter by transaction date (YYYY-MM-DD).
        page: Page number (starts at 1).
        limit: Max transactions to return.
    """
    try:
        return await show_doctor_transactions(authenticated_user_id, type, date_val, page, limit)
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_doctor_policy_details(authenticated_user_id: int) -> dict:
    """
    Get the policy details of the hospital where the authenticated doctor practices.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
    """
    db = SessionLocal()
    try:
        doctor = db.query(Doctors).filter(Doctors.id == authenticated_user_id).first()
        if not doctor:
            return {"error": "Doctor not found"}
        return await get_hospital_policy(authenticated_user_id, "doctor", doctor.hospital_id)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def complete_appointment(
    authenticated_user_id: int,
    appointment_id: int
) -> dict:
    """
    Mark an appointment as completed.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        appointment_id: The ID of the appointment to complete.
    """
    try:
        return await complete_appointment_fc(appointment_id, authenticated_user_id, "doctor")
    except Exception as e:
        return {"error": str(e)}


@tool
async def change_doctor_speciality(
    authenticated_user_id: int,
    speciality: str
) -> dict:
    """
    Update the specialty of the authenticated doctor.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        speciality: The new specialty (e.g. 'Cardiology').
    """
    db = SessionLocal()
    try:
        doctor = db.query(Doctors).filter(Doctors.id == authenticated_user_id).first()
        if not doctor:
            return {"error": "Doctor not found"}
        doctor.speciality = speciality.title()
        db.commit()
        db.refresh(doctor)
        return {
            "note": "Speciality updated successfully",
            "id": doctor.id,
            "name": doctor.name,
            "speciality": doctor.speciality
        }
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def change_doctor_transaction_note(
    authenticated_user_id: int,
    transaction_id: int,
    note: str
) -> dict:
    """
    Update/change the description note of a doctor's transaction.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        transaction_id: The ID of the transaction to modify.
        note: New note description.
    """
    try:
        return await change_note(transaction_id, note, authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def close_case_by_doctor(
    authenticated_user_id: int,
    case_id: int
) -> dict:
    """
    Close an active case from the doctor's side.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        case_id: The ID of the case to close.
    """
    db = SessionLocal()
    try:
        doctor = db.query(Doctors).filter(Doctors.id == authenticated_user_id).first()
        if not doctor:
            return {"error": "Doctor not found"}
        return await close_the_case(case_id, doctor.id, doctor.name, "doctor")
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def update_doctor_profile_details(
    authenticated_user_id: int,
    username: Optional[str] = None,
    email: Optional[str] = None,
    speciality: Optional[str] = None,
    availability: Optional[str] = None
) -> dict:
    """
    Update the profile information of the authenticated doctor.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        username: The new username.
        email: The new email address.
        speciality: The new specialty.
        availability: The doctor's availability status.
    """
    try:
        return await update_doctor_profile(username, email, speciality, availability, authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def change_doctor_fees(
    authenticated_user_id: int,
    fees: Optional[int] = None,
    appointment_fees: Optional[int] = None
) -> dict:
    """
    Update consultation fees and/or appointment fees for the authenticated doctor. Provide at least one.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        fees: Optional new base consultation fees (non-negative).
        appointment_fees: Optional new appointment fees (non-negative).
    """
    if fees is None and appointment_fees is None:
        return {"error": "At least one of fees or appointment_fees must be provided"}
    if (fees is not None and fees < 0) or (appointment_fees is not None and appointment_fees < 0):
        return {"error": "Fees cannot be negative"}

    db = SessionLocal()
    try:
        doctor = db.query(Doctors).filter(Doctors.id == authenticated_user_id).first()
        if not doctor:
            return {"error": "Doctor not found"}

        final_fees = fees if fees is not None else doctor.fees
        final_app_fees = appointment_fees if appointment_fees is not None else doctor.appointment_fees

        doctor.fees = final_fees
        doctor.appointment_fees = final_app_fees
        db.commit()
        db.refresh(doctor)
        return {
            "NOTE": f"fees updated to {final_fees} and appointment fees updated to {final_app_fees}"
        }
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def cancel_appointment_by_doctor(
    authenticated_user_id: int,
    appointment_id: Optional[int] = None,
    date_val: Optional[datetime] = None
) -> dict:
    """
    Cancel an appointment from the doctor's side.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        appointment_id: Optional appointment ID to cancel.
        date_val: Optional appointment date/time (ISO format or YYYY-MM-DD HH:MM:SS).
    """
    db = SessionLocal()
    try:
        doctor = db.query(Doctors).filter(Doctors.id == authenticated_user_id).first()
        if not doctor:
            return {"error": "Doctor not found"}
        return await cancel_appointment_fc(appointment_id, doctor.id, doctor.name, "doctor", date_val)
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@tool
async def remove_document_from_case_by_doctor(
    authenticated_user_id: int,
    case_id: int,
    document_id: int
) -> dict:
    """
    Remove a document from a specific case.

    Args:
        authenticated_user_id: The ID of the authenticated doctor.
        case_id: The ID of the case.
        document_id: The ID of the document to remove.
    """
    db = SessionLocal()
    try:
        doctor = db.query(Doctors).filter(Doctors.id == authenticated_user_id).first()
        if not doctor:
            return {"error": "Doctor not found"}
        return await remove_document_fc(case_id, document_id, doctor.id, doctor.name, "doctor")
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


doctor_tools = [
    get_doctor_profile,
    get_doctor_cases,
    get_doctor_appointments,
    get_doctor_assigned_users,
    get_doctor_fees,
    get_doctor_hospital_details,
    get_doctors_under_same_hospital,
    get_doctor_transactions,
    get_doctor_policy_details,
    complete_appointment,
    change_doctor_speciality,
    change_doctor_transaction_note,
    close_case_by_doctor,
    update_doctor_profile_details,
    change_doctor_fees,
    cancel_appointment_by_doctor,
    remove_document_from_case_by_doctor
]
