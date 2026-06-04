import os
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Query
from utils.dependencies import admin_dependency, db_dependency
from services.document_handling import get_hospital_policy_for_admin
from services.profile import see_admin_profile, update_admin_profile
from services.admin_service import delete_doctor_as_admin, delete_hospital_as_admin, delete_user_as_admin, get_all_cases_for_admin, get_all_doctors_for_admin, get_all_hospitals_for_admin, get_all_transactions_for_admin, get_all_users_for_admin, get_all_wallets_for_admin, reactivate_doctor_as_admin, reactivate_hospital_as_admin, reactivate_user_as_admin, send_notification_as_admin

router = APIRouter(
    prefix = "/admin",
    tags = ["admin"]
)

BASE_URL = os.getenv("BASE_URL")

# =====================================================================================
# PYDANTIC MODELS
# =====================================================================================

class ProfileRequest(BaseModel):
    name : str
    email : str
    phone_number : str

class NotificationRequest(BaseModel):
    recipient_id : int
    recipient_role : str
    message : str

# =====================================================================================
# GET REQUESTS
# =====================================================================================

@router.get("/profile", status_code = 200)
async def see_profile(admin : admin_dependency):
    return await see_admin_profile(admin.id)

@router.get("/users", status_code = 200)
async def get_all_users(
    admin : admin_dependency,
    name : Optional[str] = None, 
    email : Optional[str] = None, 
    account_type : Optional[str] = None, 
    is_active : Optional[str] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    return await get_all_users_for_admin(page, limit, name, email, account_type, is_active)

@router.get("/doctors", status_code = 200)
async def get_all_doctors(
    admin: admin_dependency,
    name: Optional[str] = None,
    email: Optional[str] = None,
    speciality: Optional[str] = None,
    rating: Optional[float] = None,
    availability: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge = 1),
    limit: int = Query(20, ge = 1, le = 100)
):
    return await get_all_doctors_for_admin(availability, is_active, page, limit, name, email, speciality, rating)

@router.get("/hospitals", status_code = 200)
async def get_all_hospitals(
    admin : admin_dependency,
    name : Optional[str] = None,
    email : Optional[str] = None,
    city : Optional[str] = None,
    state : Optional[str] = None,
    zip : Optional[str] = None,
    rating : Optional[int] = None,
    cases : Optional[int] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    return await get_all_hospitals_for_admin(page, limit, name, email, city, state, zip, rating, cases)

@router.get("/cases", status_code = 200)
async def get_all_cases(
    admin : admin_dependency,
    date : Optional[datetime] = None,
    doctor_name : Optional[str] = None,
    user_name : Optional[str] = None,
    cost : Optional[float] = None,
    diesease : Optional[str] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    return await get_all_cases_for_admin(admin.id, page, limit, date, doctor_name, user_name, cost, diesease)

@router.get("/transactions/", status_code = 200)
async def get_all_transactions(
    admin : admin_dependency,
    usertype : Optional[str] = Query("all", description = "user, doctor, or all"),
    date : Optional[datetime] = None,
    amount : Optional[float] = None,
    page : int = Query(1, ge = 1), 
    limit : int = Query(20, ge = 1, le = 100)
):
    return await get_all_transactions_for_admin(page, limit, usertype, date, amount)

@router.get("/wallets/", status_code = 200)
async def get_all_wallets(
    admin : admin_dependency,
    role : Optional[str] = None,
    amount : Optional[int] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    return await get_all_wallets_for_admin(page, limit, role, amount)

@router.get("/policy", status_code = 200)
async def get_hospital_policy(admin : admin_dependency, hospital_id : Optional[int] = None):
    return await get_hospital_policy_for_admin(admin.id, hospital_id)

# =====================================================================================
# POST REQUESTS
# =====================================================================================

@router.post("/notification/", status_code = 200)
async def send_notification(admin : admin_dependency, notification : NotificationRequest):
    return await send_notification_as_admin(notification.message, notification.recipient_id, notification.recipient_role)

# =====================================================================================
# PUT REQUESTS
# =====================================================================================

@router.put("/profile", status_code = 200)
async def update_profile(admin : admin_dependency, request : ProfileRequest):
    return await update_admin_profile(admin.id, request.name, request.email, request.phone_number)

@router.put("/reactive/user/{user_id}", status_code = 200)
async def reactivate_user(admin : admin_dependency, user_id : int):
    return await reactivate_user_as_admin(user_id)

@router.put("/reactive/doctor/{doctor_id}", status_code = 200)
async def reactivate_doctor(admin : admin_dependency, doctor_id : int):
    return await reactivate_doctor_as_admin(doctor_id)

@router.put("/reactive/hospital/{hospital_id}", status_code = 200)
async def reactivate_hospital(admin : admin_dependency, hospital_id : int):
    return await reactivate_hospital_as_admin(hospital_id)

# =====================================================================================
# DELETE REQUESTS
# =====================================================================================

@router.delete("/users/{user_id}", status_code = 200)
async def delete_user(admin : admin_dependency, user_id : int):
    return await delete_user_as_admin(user_id)

@router.delete("/doctors/{doctor_id}", status_code = 200)
async def delete_doctor(admin : admin_dependency, doctor_id : int):
    return await delete_doctor_as_admin(doctor_id)

@router.delete("/hospital/{hospital_id}", status_code = 200)
async def delete_hospital(admin : admin_dependency, hospital_id : int):
    return await delete_hospital_as_admin(hospital_id)

