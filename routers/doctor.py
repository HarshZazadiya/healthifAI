import os
from fastapi import Query
from models import Doctors
from typing import Optional
from datetime import datetime, date
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from services.document_handling import get_hospital_policy
from utils.dependencies import doctor_dependency, db_dependency
from services.wallet import change_note, show_doctor_transactions
from services.profile import doctor_profile, update_doctor_profile
from services.cases import close_the_case, get_doctors_cases, remove_document_fc
from services.appointments import cancel_appointment_fc, complete_appointment_fc, get_appointments
from services.doctor_service import get_assigned_users_of_doctor, get_doctors_under_same_hospital, get_hospital_details

router = APIRouter(
    prefix = "/doctor",
    tags = ["doctor"]
)
 
BASE_URL = os.getenv("BASE_URL")

# =====================================================================================
# PYDANCTIC MODELS
# =====================================================================================

class ProfileRequest(BaseModel):
    username : Optional[str] = Field(min_length = 1, max_length = 100)
    email : Optional[str] = EmailStr
    availability : Optional[str] = Field(min_length = 1, max_length = 100)
    speciality : Optional[str] = Field(min_length = 1, max_length = 100)

class feesChangeRequest(BaseModel):
    fees : Optional[int] = Field(ge = 0)
    appointment_fees : Optional[int] = Field(ge = 0)

# =====================================================================================
# GET REQUESTS
# =====================================================================================

@router.get("/profile", status_code = 200)
async def get_profile(doctor : doctor_dependency):
    return await doctor_profile(doctor.id)

@router.get("/cases", status_code = 200)
async def get_my_cases(
    doctor : doctor_dependency,
    status : Optional[str] = None,
    from_date : Optional[datetime] = None,
    to_date : Optional[datetime] = None,
    user_id : Optional[int] = None,
    case_id : Optional[int] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100),
):
    return await get_doctors_cases(doctor.id, status, from_date, to_date, user_id, case_id, page, limit)
    
@router.get("/appointment/", status_code = 200)
async def appointments(doctor : doctor_dependency, date : Optional[date] = None,  status : Optional[str] = None,  page : int = 1,  limit : int = 10):    
    return await get_appointments(doctor.id, "doctor", page, limit, status, date)

@router.get("/assigned-users/", status_code = 200)
async def get_assigned_users(doctor : doctor_dependency, user_name : Optional[str] = None, page : int = 1, limit : int = 10):
    return await get_assigned_users_of_doctor(doctor.id, page, limit, user_name)

@router.get("/fees")
async def get_my_fees(doctor : doctor_dependency, db : db_dependency):
    doct = db.query(Doctors).filter(Doctors.id == doctor.id).first()
    return {
        "fees" : doct.fees,
        "appointment_fees" : doct.appointment_fees
    }

@router.get("/hospital", status_code = 200)
async def get_my_hospital_details(doctor : doctor_dependency):
    return await get_hospital_details(doctor)

@router.get("/doctors", status_code = 200)
async def get_all_doctors_under_same_hospital(doctor : doctor_dependency, db : db_dependency):
    return await get_doctors_under_same_hospital(doctor.id)

@router.get("/transactions/", status_code = 200)
async def show_all_transactions(doctor : doctor_dependency, db : db_dependency, type : Optional[str] = None, date : Optional[date] = None, page : int = 1, limit : int = 10):
    return await show_doctor_transactions(doctor.id, type, date, page, limit)

@router.get("/policy", status_code = 200)
async def get_my_policy_details(doctor : doctor_dependency, db : db_dependency):
    return await get_hospital_policy(doctor.id, "doctor", doctor.hospital_id)

# =====================================================================================
# POST REQUESTS
# =====================================================================================



# =====================================================================================
# PUT REQUESTS
# =====================================================================================

@router.put("/appointment", status_code = 200)
async def complete_appointment(appointment_id : int, doctor : doctor_dependency, db : db_dependency):
    result = await complete_appointment_fc(appointment_id, doctor.id, "doctor")
    return result

@router.put("/speciality", status_code = 200)
async def change_speciality(speciality : str, doctor : doctor_dependency, db : db_dependency):
    doctor.speciality = speciality.title()
    db.commit()
    db.refresh(doctor)
    return {
        "note" : "Speciality updated successfully",
        "id" : doctor.id,
        "name" : doctor.name,
        "speciality" : doctor.speciality
    }

@router.put("/transactions", status_code = 200)
async def change_transaction_note(transaction_id : int, note : str, doctor : doctor_dependency):
    return await change_note(transaction_id, note, doctor.id)

@router.put("/cases/{case_id}", status_code = 200)
async def close_case(case_id : int, doctor : doctor_dependency, db : db_dependency):
    return await close_the_case(case_id, doctor.id, doctor.name, "doctor")

@router.put("/profile", status_code = 200)
async def update_profile(request : ProfileRequest, doctor : doctor_dependency):
    return await update_doctor_profile(request.username, request.email, request.speciality, request.availability, doctor.id)

@router.put("/fees", status_code = 200)
async def change_fees(doctor : doctor_dependency, feesRequest : feesChangeRequest, db : db_dependency):
    # if both are none then throw error
    if not feesRequest.fees and not feesRequest.appointment_fees:
        raise HTTPException(status_code = 400, detail = "At least one of fees or appointment_fees must be provided")
    # if any of them is negative then also throw error
    if feesRequest.fees < 0 or feesRequest.appointment_fees < 0:
        raise HTTPException(status_code = 400, detail = "Fees cannot be negative")
    
    fees = feesRequest.fees if feesRequest.fees else doctor.fees
    appointment_fees = feesRequest.appointment_fees if feesRequest.appointment_fees else doctor.appointment_fees
    # find the doctor and update the fees and appointment fees
    doct = db.query(Doctors).filter(Doctors.id == doctor.id).first()
    doct.fees = fees
    doct.appointment_fees = appointment_fees
    db.commit()
    db.refresh(doct)
    return {
        "NOTE" : f"fees updatesd to {fees} and appointment fees updated to {appointment_fees}"
    }

# =====================================================================================
# DELETE REQUESTS
# =====================================================================================

@router.delete("/appointment/", status_code = 200)
async def cancel_appointment(doctor : doctor_dependency, appointment_id : Optional[int] = None):
    return await cancel_appointment_fc(appointment_id, doctor.id, doctor.name, "doctor", date)

@router.delete("/cases/document", status_code = 200)
async def remove_document_from_case(doctor : doctor_dependency, case_id : int = Query(..., gt = 0), document_id : int = Query(..., gt = 0)):
    return await remove_document_fc(case_id, document_id, doctor.id, doctor.name, "doctor")