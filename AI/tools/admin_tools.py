import os
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
        authenticated_user_id: The ID of the authenticated admin.
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
        page: Page number (starts at 1).
        limit: Max users to return.
        name: Filter users by name.
        email: Filter users by email.
        account_type: Filter by account type (e.g. 'user', 'doctor', 'hospital').
        is_active: Filter by active status (e.g. 'True', 'False').
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
        name: Filter by doctor name.
        email: Filter by doctor email.
        speciality: Filter by specialty.
        rating: Filter by minimum rating.
        availability: Filter by doctor availability.
        is_active: Filter by active status.
        page: Page number (starts at 1).
        limit: Max doctors to return.
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
        name: Filter by hospital name.
        email: Filter by hospital email.
        city: Filter by hospital city.
        state: Filter by hospital state.
        zip_code: Filter by hospital ZIP code.
        rating: Filter by hospital rating.
        cases: Filter by hospital cases count.
        page: Page number (starts at 1).
        limit: Max hospitals to return.
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
        authenticated_user_id: The ID of the authenticated admin.
        date_val: Optional filter by case date (YYYY-MM-DD).
        doctor_name: Optional filter by doctor's name.
        user_name: Optional filter by user's name.
        cost: Optional filter by case cost.
        diesease: Optional filter by disease/symptom.
        page: Page number (starts at 1).
        limit: Max cases to return.
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
        usertype: Filter by type ('user', 'doctor', or 'all').
        date_val: Filter by transaction date (YYYY-MM-DD).
        amount: Filter by exact transaction amount.
        page: Page number (starts at 1).
        limit: Max transactions to return.
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
        role: Optional role filter (e.g. 'user', 'doctor', 'hospital', 'admin').
        amount: Optional balance amount filter.
        page: Page number (starts at 1).
        limit: Max wallets to return.
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
        authenticated_user_id: The ID of the authenticated admin.
        hospital_id: Optional hospital ID to filter by.
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
        recipient_id: The ID of the recipient.
        recipient_role: Role of the recipient (e.g., 'user', 'doctor', 'hospital').
        message: The message body to send.
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
        receiver_id: The ID of the receiver.
        receiver_role: The role of the receiver ('user', 'doctor', or 'hospital').
        message: The message body to send.
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
        authenticated_user_id: The ID of the authenticated admin.
        name: New admin name.
        email: New admin email.
        phone_number: New admin phone number.
    """
    try:
        return await update_admin_profile(authenticated_user_id, name, email, phone_number)
    except Exception as e:
        return {"error": str(e)}


@tool
async def reactivate_user(user_id: int) -> dict:
    """
    Reactivate a deactivated user account.

    Args:
        user_id: The ID of the user to reactivate.
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
        doctor_id: The ID of the doctor to reactivate.
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
        hospital_id: The ID of the hospital to reactivate.
    """
    try:
        return await reactivate_hospital_as_admin(hospital_id)
    except Exception as e:
        return {"error": str(e)}


@tool
async def delete_user(user_id: int) -> dict:
    """
    Deactivate/delete a user account from the system.

    Args:
        user_id: The ID of the user to deactivate/delete.
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
        doctor_id: The ID of the doctor to deactivate/delete.
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
        hospital_id: The ID of the hospital to deactivate/delete.
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
