import os
from models import  Users
from typing import List, Optional
from services.payment import handle_payment
from datetime import date, datetime, timezone
from services.notification import create_notification
from services.document_handling import get_hospital_policy
from utils.dependencies import user_dependency, db_dependency
from utils.distance_user_hospital import find_n_nearby_doctors
from services.profile import update_user_profile, user_profile
from services.wallet import change_note, show_user_transactions
from pydantic import BaseModel, Field, field_validator, EmailStr
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from services.doctor_service import assign_doctor_to_user, get_all_doctors, get_my_doctors
from services.symptoms import add_symptom, delete_symptom_fc, get_symptoms, update_symptom_fc
from services.appointments import add_appointment, cancel_appointment_fc, get_appointments, update_appointment_fc
from services.cases import add_documents_tc, add_symptom_tc, case_reopen, close_the_case, get_users_cases, remove_document_fc, remove_symptom_fc

# TODO : Add pagination, add
router = APIRouter(
    prefix = "/user",
    tags = ["User"]
)

# =====================================================================================
# CONSTANTS
# =====================================================================================

BASE_URL = os.getenv("BASE_URL")
PRIMIUM_PLAN_FEES = os.getenv("PRIMIUM_PLAN_FEES")

# =====================================================================================
# PYDANTIC CLASSES
# =====================================================================================

class Symptom_request(BaseModel):
    symptom: str = Field(min_length=1, max_length=100)
    severity: int = Field(ge=0, le=10)

    @field_validator('severity')
    @classmethod
    def validate_severity_digits(cls, v: int) -> int:
        """Ensure severity is between 0 and 99 (2 digits max)."""
        if v < 0 or v > 99:
            raise ValueError("Severity must be a positive integer with at most 2 digits")
        return v

class AppointmentRequest(BaseModel):
    doctor_id : int = Field(gt = 0)
    date : datetime 

    @field_validator('date')
    @classmethod
    def check_future_date(cls, v: datetime) -> datetime:
        # Ensure the datetime is not in the past
        if v < datetime.now(timezone.utc):
            raise ValueError('Event time must be in the future')
        return v

class UpdateAppointmentRequest:
    date : datetime

    @field_validator('date')
    @classmethod
    def check_future_date(cls, v: datetime) -> datetime:
        # Ensure the datetime is not in the past
        if v < datetime.now(timezone.utc):
            raise ValueError('Event time must be in the future')
        return v

class LocationUpdate(BaseModel):
    latitude : float = Field(gt = -90, lt = 90)
    longitude : float = Field(gt = -180, lt = 180)

class ProfileRequest(BaseModel):
    username : str = Field(min_length = 1, max_length = 100)
    email : EmailStr

class SymptomIDsRequest(BaseModel):
    symptom_ids : List[int] = None

class DocumentIDsRequest(BaseModel):
    document_ids : List[int] = None

# =====================================================================================
# GET REQUESTS
# =====================================================================================

@router.get("/profile", status_code = 200)
async def see_profile(user : user_dependency):
    return await user_profile(user.id, user.role)

@router.get("/cases", status_code = 200)
async def get_my_cases(
    user : user_dependency,
    status : Optional[str] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(4, ge = 1, le = 100),
    from_date : Optional[datetime] = None,
    to_date : Optional[datetime] = None,
    doctor_id : Optional[int] = None,
    case_id : Optional[int] = None
):
    return await get_users_cases(user.id, status, page, limit, from_date, to_date, doctor_id, case_id)

@router.get("/appointment", status_code = 200)
async def appointments(
    user : user_dependency,
    status : Optional[str] = None, 
    date : Optional[datetime] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    return await get_appointments(user.id, user.role, page, limit, status, date)
     
@router.get("/doctors/", status_code=200)
async def see_all_doctors(
    user : user_dependency,
    doctor_name : Optional[str] = None, 
    hospital_name : Optional[str] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    return await get_all_doctors(page, limit, doctor_name, hospital_name)

@router.get("/my-doctors/", status_code = 200)
async def my_doctors(
    user : user_dependency,
    doctor_name : Optional[str] = None, 
    hospital_name : Optional[str] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    return await get_my_doctors(user.id, page, limit, doctor_name, hospital_name)

@router.get("/symptom", status_code = 200)
async def symptoms(user : user_dependency, date : Optional[date] = None, page : int = Query(1, ge = 1), limit : int = Query(20, ge = 1, le = 100)):
    return await get_symptoms(user.id, page, limit, date)

@router.get("/nearby-doctors/{n}", status_code = 200)
async def get_nearby_doctors(user : user_dependency, db : db_dependency, n : int):
    # TODO : add logic to search only for the doctor which specialize in the field of user's diesease
    results = await find_n_nearby_doctors(user.id, n)
    return {
        "status" : "success",
        "message" : "Nearby doctors found successfully",
        "data" : results
    }

@router.get("/location", status_code = 200)
async def get_user_location(user : user_dependency, db : db_dependency):
    return {
        "user_id" : user.id,
        "latitude" : user.lat,
        "longitude" : user.lon,
        "has_location" : user.lat is not None and user.lon is not None
    }

@router.get("/transactions/", status_code=200)
async def show_all_transactions(
    user : user_dependency,
    type : Optional[str] = None, 
    date : Optional[date] = None, 
    page : int = Query(1, ge=1), 
    limit : int = Query(20, ge=1, le=100)
):
    result = await show_user_transactions(user.id, page, limit, type, date)
    return result

@router.get("/policy/{hospital_id}", status_code = 200)
async def get_hospital_policy_details(user : user_dependency, hospital_id : Optional[int] = None):
    return await get_hospital_policy(user.id, user.role, hospital_id)

# =====================================================================================
# POST REQUESTS
# =====================================================================================

@router.post("/symptom", status_code = 201)
async def symptom(request : Symptom_request, user : user_dependency, case_id : Optional[int] = None):
    return await add_symptom(request.symptom, request.severity, user.id,case_id)

@router.post("/assign/{doctor_id}", status_code = 200)
async def assign_doctor(doctor_id : int, user : user_dependency):
    return await assign_doctor_to_user(doctor_id, user.id, user.role, user.name)

@router.post("/appointment", status_code=201)
async def book_appointment(request: AppointmentRequest, user: user_dependency):
    return await add_appointment(user.id, user.role, user.name, request.doctor_id, request.date)

# =====================================================================================
# PUT REQUESTS
# =====================================================================================

@router.put("/upgrade", status_code = 200)
async def upgrade_user(user : user_dependency, background_tasks : BackgroundTasks = BackgroundTasks()):
    result = await handle_payment(user.id, user.role, 1, "admin", PRIMIUM_PLAN_FEES, note = f"Buying PREMIUM PLAN", type = "OUTGOING")
    background_tasks.add_task(
        create_notification(
            message = f"You have been successfully upgraded to PREMIUM PLAN user", 
            recipient_id = user.id, 
            recipient_role = "user"
        )
    )

    return result

@router.put("/reopen/{case_id}", status_code = 200)
async def reopen_case(case_id : int, user : user_dependency, ):
    return await case_reopen(case_id, user.id, user.role, user.name)

@router.put("/cases/{case_id}/symptoms", status_code = 200)
async def add_symptoms_to_case(case_id : int, user : user_dependency, request : SymptomIDsRequest):
    return await add_symptom_tc(user.id, user.role, case_id, request.symptom_ids)

@router.put("/cases/{case_id}/documents", status_code = 200)
async def add_documents_to_case(case_id : int, user : user_dependency, request : DocumentIDsRequest):
    return await add_documents_tc(case_id, user.id, user.name, request.document_ids)

@router.put("/cases/close/{case_id}", status_code = 200)
async def close_case(case_id : int, user : user_dependency):
    return await close_the_case(case_id, user.id, user.name, user.role)

@router.put("/profile", status_code = 200)
async def update_profile(request : ProfileRequest, user : user_dependency):
    return update_user_profile(user.id, request.username, request.email)

@router.put("/symptom", status_code = 200)
async def update_symptom(symptom_id : int, request : Symptom_request, user : user_dependency):
    return await update_symptom_fc(symptom_id, request.symptom, request.severity, user.id)

@router.put("/appointment/{appointment_id}", status_code = 200)
async def update_appointment(appointment_id : int, request : AppointmentRequest, user : user_dependency):
    return await update_appointment_fc(appointment_id, user.id, user.name, user.role, request.date)

@router.put("/location", status_code = 200)
async def update_user_location(location : LocationUpdate, user : user_dependency, db : db_dependency):
    # Re-query the user to ensure it's attached to the current session
    user = db.query(Users).filter(Users.id == user.id).first()
    
    if not user:
        raise HTTPException(status_code = 404, detail = "User not found")
    
    # Update location
    user.lat = location.latitude
    user.lon = location.longitude
    
    db.commit()
    db.refresh(user)
    
    return {
        "message" : "Location updated successfully",
        "user_id" : user.id,
        "latitude" : float(user.lat) if user.lat else None,
        "longitude" : float(user.lon) if user.lon else None
    }

@router.put("/transactions", status_code = 200)
async def change_transaction_note(transaction_id : int, note : str, user : user_dependency):
    return change_note(transaction_id, note, user.id)

# =====================================================================================
# DELETE REQUESTS
# =====================================================================================

@router.delete("/cases/symptom/{case_id}/{symptom_id}")
async def remove_symptom_from_case(case_id : int, symptom_id : int, user : user_dependency, db : db_dependency):
    return await remove_symptom_fc(case_id, symptom_id, user.id)

@router.delete("/cases/document/{case_id}/{document_id}")
async def remove_document_from_case(case_id : int, document_id : int, user : user_dependency):
    return await remove_document_fc(case_id, document_id, user.id, user.name)
    
@router.delete("/symptom/{symptom_id}", status_code=200)
async def delete_symptom(symptom_id : int,  user : user_dependency,force : bool = False):
    return await delete_symptom_fc(symptom_id, user.id, user.name, force)

@router.delete("/appointment/{appointment_id}", status_code = 200)
async def cancel_appointment(appointment_id : int, user : user_dependency):
    return await cancel_appointment_fc(appointment_id, user.id, user.name, user.role)

@router.delete("/location", status_code = 200)
async def remove_location(user : user_dependency, db : db_dependency):
    user.lat = None
    user.lon = None
    
    db.commit()
    
    return {
        "note" : "Location removed successfully",
        "status" : "success"
    }