from typing import Optional
from datetime import datetime
from langchain_core.tools import tool
from services.document_handling import get_hospital_policy_for_admin
from services.profile import see_admin_profile, update_admin_profile
from services.notification import create_notification
from services.admin_service import (
    delete_doctor_as_admin,
    delete_hospital_as_admin,
    delete_user_as_admin,
    get_all_cases_for_admin,
    get_all_doctors_for_admin,
    get_all_hospitals_for_admin,
    get_all_transactions_for_admin,
    get_all_users_for_admin,
    get_all_wallets_for_admin,
    reactivate_doctor_as_admin,
    reactivate_hospital_as_admin,
    reactivate_user_as_admin,
    send_notification_as_admin,
)


@tool
async def see_profile_admin(authenticated_user_id: int) -> dict:
    """
    Get the authenticated admin's profile details.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated admin. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 1', pass 1).
    """
    try:
        return await see_admin_profile(authenticated_user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def see_all_users(
    page: int = 1,
    limit: int = 20,
    name: Optional[str] = None,
    email: Optional[str] = None,
    account_type: Optional[str] = None,
    is_active: Optional[str] = None
) -> dict:
    """
    Get a paginated list of all users in the system (admin view), with optional filters.

    Args:
        page (int): Page number for pagination (starts at 1).
        limit (int): Max users to return.
        name (str, optional): Optional user name string to filter.
        email (str, optional): Optional user email string to filter.
        account_type (str, optional): Optional account type string to filter (e.g. 'user', 'doctor', 'hospital').
        is_active (str, optional): Optional active status string to filter (e.g. 'True', 'False').
    """
    try:
        return await get_all_users_for_admin(page, limit, name, email, account_type, is_active)
    except Exception as e:
        return {"error": str(e)}


@tool
async def see_all_doctors(
    name: Optional[str] = None,
    email: Optional[str] = None,
    speciality: Optional[str] = None,
    rating: Optional[float] = None,
    availability: Optional[bool] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    limit: int = 20
) -> dict:
    """
    Get a paginated list of all doctors in the system (admin view), with optional filters.

    Args:
        name (str, optional): Optional doctor name string to filter.
        email (str, optional): Optional doctor email string to filter.
        speciality (str, optional): Optional doctor specialty string to filter.
        rating (float, optional): Optional minimum doctor rating float to filter (e.g. 1.0 to 5.0).
        availability (bool, optional): Optional doctor availability boolean to filter.
        is_active (bool, optional): Optional doctor active status boolean to filter.
        page (int): Page number for pagination (starts at 1).
        limit (int): Max doctors to return.
    """
    try:
        return await get_all_doctors_for_admin(availability, is_active, page, limit, name, email, speciality, rating)
    except Exception as e:
        return {"error": str(e)}


@tool
async def see_all_hospitals(
    name: Optional[str] = None,
    email: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    zip_code: Optional[str] = None,
    rating: Optional[int] = None,
    cases: Optional[int] = None,
    page: int = 1,
    limit: int = 20
) -> dict:
    """
    Get a paginated list of all hospitals in the system (admin view), with optional filters.

    Args:
        name (str, optional): Optional hospital name string to filter.
        email (str, optional): Optional hospital email string to filter.
        city (str, optional): Optional hospital city string to filter.
        state (str, optional): Optional hospital state string to filter.
        zip_code (str, optional): Optional hospital ZIP code string to filter.
        rating (int, optional): Optional minimum hospital rating integer to filter (e.g. 1 to 5).
        cases (int, optional): Optional cases count filter (integer).
        page (int): Page number for pagination (starts at 1).
        limit (int): Max hospitals to return.
    """
    try:
        return await get_all_hospitals_for_admin(page, limit, name, email, city, state, zip_code, rating, cases)
    except Exception as e:
        return {"error": str(e)}


@tool
async def see_all_cases(
    authenticated_user_id: int,
    date_val: Optional[datetime] = None,
    doctor_name: Optional[str] = None,
    user_name: Optional[str] = None,
    cost: Optional[float] = None,
    diesease: Optional[str] = None,
    page: int = 1,
    limit: int = 20
) -> dict:
    """
    Get a paginated list of all cases in the system (admin view), with optional filters.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated admin. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 1', pass 1).
        date_val (str, optional): Optional case date filter. MUST be an ISO 8601 string format (e.g., 'YYYY-MM-DD').
        doctor_name (str, optional): Optional doctor's name filter string.
        user_name (str, optional): Optional user/patient name filter string.
        cost (float, optional): Optional case cost filter (float).
        diesease (str, optional): Optional disease/symptom filter string.
        page (int): Page number for pagination (starts at 1).
        limit (int): Max cases to return.
    """
    try:
        return await get_all_cases_for_admin(authenticated_user_id, page, limit, date_val, doctor_name, user_name, cost, diesease)
    except Exception as e:
        return {"error": str(e)}


@tool
async def see_all_transactions(
    usertype: Optional[str] = "all",
    date_val: Optional[datetime] = None,
    amount: Optional[float] = None,
    page: int = 1,
    limit: int = 20
) -> dict:
    """
    Get all transaction histories across the entire system (admin view), with optional filters.

    Args:
        usertype (str, optional): Filter by transaction user type string ('user', 'doctor', or 'all').
        date_val (str, optional): Optional transaction date filter. MUST be an ISO 8601 string format (e.g., 'YYYY-MM-DD').
        amount (float, optional): Optional transaction amount filter (float).
        page (int): Page number for pagination (starts at 1).
        limit (int): Max transactions to return.
    """
    try:
        return await get_all_transactions_for_admin(page, limit, usertype, date_val, amount)
    except Exception as e:
        return {"error": str(e)}


@tool
async def see_all_wallets(
    role: Optional[str] = None,
    amount: Optional[int] = None,
    page: int = 1,
    limit: int = 20
) -> dict:
    """
    Get details of all wallets in the system (admin view).

    Args:
        role (str, optional): Optional role string to filter by (e.g. 'user', 'doctor', 'hospital', 'admin').
        amount (int, optional): Optional wallet balance amount to filter by (integer).
        page (int): Page number for pagination (starts at 1).
        limit (int): Max wallets to return.
    """
    try:
        return await get_all_wallets_for_admin(page, limit, role, amount)
    except Exception as e:
        return {"error": str(e)}


@tool
async def see_hospital_policy_admin(
    authenticated_user_id: int,
    hospital_id: Optional[int] = None
) -> dict:
    """
    Get policy details of a specific hospital or all hospitals in the system (admin view).

    Args:
        authenticated_user_id (int): The ID of the currently authenticated admin. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 1', pass 1).
        hospital_id (int, optional): Optional hospital ID to filter by. To obtain a hospital ID, search for hospitals first.
    """
    try:
        return await get_hospital_policy_for_admin(authenticated_user_id, hospital_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def send_notification_admin(
    recipient_id: int,
    recipient_role: str,
    message: str
) -> dict:
    """
    Send an administrative notification to a specific user, doctor, or hospital.

    Args:
        recipient_id (int): The ID of the recipient user/doctor/hospital. To find recipient IDs, search users, doctors, or hospitals first.
        recipient_role (str): Role of the recipient (e.g., 'user', 'doctor', 'hospital').
        message (str): The message body string to send. Must be a non-empty string.
    """
    try:
        return await send_notification_as_admin(message, recipient_id, recipient_role)
    except Exception as e:
        return {"error": str(e)}


@tool
async def send_global_notification_admin(
    receiver_id: int,
    receiver_role: str,
    message: str
) -> dict:
    """
    Send a global administrative/system notification using standard create notification handler.

    Args:
        receiver_id (int): The ID of the receiver user/doctor/hospital. To find receiver IDs, search users, doctors, or hospitals first.
        receiver_role (str): The role of the receiver ('user', 'doctor', or 'hospital').
        message (str): The message body string to send. Must be a non-empty string.
    """
    try:
        return await create_notification(message, receiver_id, receiver_role)
    except Exception as e:
        return {"error": str(e)}


@tool
async def update_admin_profile_details(
    authenticated_user_id: int,
    name: str,
    email: str,
    phone_number: str
) -> dict:
    """
    Update the authenticated admin's profile information.

    Args:
        authenticated_user_id (int): The ID of the currently authenticated admin. You MUST extract this value from the system prompt's Current User ID field (e.g. if the system prompt says 'ID: 1', pass 1).
        name (str): New admin name. Must be a non-empty string.
        email (str): New admin email address string.
        phone_number (str): New admin phone number string.
    """
    try:
        return await update_admin_profile(authenticated_user_id, name, email, phone_number)
    except Exception as e:
        return {"error": str(e)}


@tool
async def reactivate_user(user_id: int) -> dict:
    """
    Reactivate a deactivated user/patient account.

    Args:
        user_id (int): The ID of the user/patient to reactivate. To find user IDs, query users first.
    """
    try:
        return await reactivate_user_as_admin(user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def reactivate_doctor(doctor_id: int) -> dict:
    """
    Reactivate a deactivated doctor account.

    Args:
        doctor_id (int): The ID of the doctor to reactivate. To find doctor IDs, query doctors first.
    """
    try:
        return await reactivate_doctor_as_admin(doctor_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def reactivate_hospital(hospital_id: int) -> dict:
    """
    Reactivate a deactivated hospital account.

    Args:
        hospital_id (int): The ID of the hospital to reactivate. To find hospital IDs, query hospitals first.
    """
    try:
        return await reactivate_hospital_as_admin(hospital_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def delete_user(user_id: int) -> dict:
    """
    Deactivate/delete a user/patient account from the system.

    Args:
        user_id (int): The ID of the user/patient to deactivate/delete. To find user IDs, query users first.
    """
    try:
        return await delete_user_as_admin(user_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def delete_doctor(doctor_id: int) -> dict:
    """
    Deactivate/delete a doctor account from the system.

    Args:
        doctor_id (int): The ID of the doctor to deactivate/delete. To find doctor IDs, query doctors first.
    """
    try:
        return await delete_doctor_as_admin(doctor_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def delete_hospital(hospital_id: int) -> dict:
    """
    Deactivate/delete a hospital account from the system.

    Args:
        hospital_id (int): The ID of the hospital to deactivate/delete. To find hospital IDs, query hospitals first.
    """
    try:
        return await delete_hospital_as_admin(hospital_id)
    except Exception as e:
        return {"error": str(e)}


admin_tools = [
    see_profile_admin,
    see_all_users,
    see_all_doctors,
    see_all_hospitals,
    see_all_cases,
    see_all_transactions,
    see_all_wallets,
    see_hospital_policy_admin,
    send_notification_admin,
    send_global_notification_admin,
    update_admin_profile_details,
    reactivate_user,
    reactivate_doctor,
    reactivate_hospital,
    delete_user,
    delete_doctor,
    delete_hospital
]
