import os
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from utils.helper import bcrypt_context
from fastapi import BackgroundTasks, Query
from services.cases import get_hospitals_cases
from services.user_service import get_all_users_for_hospital
from models import Hospitals, Doctors, AssignedDoctors, Wallet
from fastapi import File, HTTPException, APIRouter, UploadFile
from services.wallet import show_doctor_transactions_for_hospital
from utils.dependencies import hospital_dependency, db_dependency
from services.appointments import get_all_appointments_for_hospital
from services.profile import hospital_profile, update_hospital_profile
from services.availibility import set_availibility_for_doctor, set_limit_for_doctor
from services.document_handling import add_document, get_hospital_policy_for_hospital, update_policy
from services.doctor_service import get_all_doctors_for_hospital, get_doctor_fees_for_hospital, get_doctors_balance_for_hospital

router = APIRouter(
    prefix = "/hospital",
    tags = ["hospital"]
)

BASE_URL = os.getenv("BASE_URL")
# =====================================================================================
# PYDANTIC MODELS
# =====================================================================================

class ProfileRequest(BaseModel):
    username : Optional[str]
    email : Optional[str]
    address : Optional[str]
    city : Optional[str]
    state : Optional[str]
    zip : Optional[str]
    phone_number : Optional[str]

class CreateDoctorRequest(BaseModel):
    name : str
    email : str
    password : str
    phone_number : str 

class ChargesRequest(BaseModel):
    charges : float

# =====================================================================================
# GET REQUESTS
# =====================================================================================

@router.post("/doctor", status_code = 201)
async def create_doctor(request : CreateDoctorRequest, db : db_dependency, hospital : hospital_dependency):
    doctor = Doctors(
        name = request.name.title(),
        email = request.email,
        hospital_id = hospital.id,
        phone_number = request.phone_number,  
        hashed_password = bcrypt_context.hash(request.password),
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    wallet = Wallet(
        user_id = doctor.id, 
        role = "doctor", 
        balance = 0
    )
    db.add(wallet)
    db.commit()
    
    return {"id" : doctor.id,  "name" : doctor.name}

@router.get("/profile", status_code = 200)
async def see_profile(hospital : hospital_dependency):
    return await hospital_profile(hospital.id)

@router.get("/doctors", status_code = 200)
async def get_all_doctors(
    hospital : hospital_dependency, 
    db : db_dependency, 
    page : int = Query(1, ge = 1), 
    limit : int = Query(20, ge = 1, le = 100), 
    rating : Optional[int] = None,
    email : Optional[str] = None,
    speciality : Optional[str] = None,
    name : Optional[str] = None,
    availability : Optional[bool] = None
):
    return await get_all_doctors_for_hospital(hospital.id, page, limit, rating, email, speciality, name, availability)

@router.get("/users", status_code = 200)
async def get_all_users(
    hospital: hospital_dependency,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    user_name: Optional[str] = None,
    doctor_name: Optional[str] = None,
):
    return await get_all_users_for_hospital(hospital.id, page, limit, status, user_name, doctor_name)

@router.get("/cases", status_code = 200)
async def get_hospital_cases(
    hospital: hospital_dependency,
    db: db_dependency,
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    doctor_id: Optional[int] = None,
    case_id: Optional[int] = None,
    page: int = Query(1, ge = 1),
    limit: int = Query(20, ge = 1, le = 100),
):
    result = await get_hospitals_cases(hospital.id, status, from_date, to_date, doctor_id, case_id, page, limit)
    return result

@router.get("/doctor-balance", status_code = 200)
async def get_doctors_balance(
    hospital : hospital_dependency,
    page : int = Query(1, ge = 1), 
    limit : int = Query(20, ge = 1, le = 100),
    doctor_name : Optional[str] = None
):
    return await get_doctors_balance_for_hospital(hospital.id, page, limit, doctor_name)

@router.get("/fees", status_code = 200)
async def get_doctor_fees(hospital : hospital_dependency):
    return await get_doctor_fees_for_hospital(hospital.id)

@router.get("/location", status_code = 200)
async def get_hospital_location(hospital : hospital_dependency):
    return {"latitude" : hospital.lat, "longitude" : hospital.lon}

@router.get("/appointments", status_code = 200)
async def get_all_appointments(hospital : hospital_dependency):
    return await get_all_appointments_for_hospital(hospital.id)

@router.get("/policy", status_code = 200)
async def get_hospital_policy(hospital : hospital_dependency):
    return await get_hospital_policy_for_hospital(hospital.id)

@router.get("/doctor-transactions", status_code = 200)
async def show_doctor_transactions(
    hospital : hospital_dependency, 
    db : db_dependency, 
    type : Optional[str] = None, 
    date : Optional[datetime] = None,
    page : int = Query(1, ge = 1), 
    limit : int = Query(20, ge = 1, le = 100),
    doctor_name : Optional[str] = None
):
    return await show_doctor_transactions_for_hospital(hospital.id, page, limit, type, date, doctor_name)

# =====================================================================================
# POST REQUESTS
# =====================================================================================

@router.post("/policy", status_code = 200)
async def set_policy_for_hospital(hospital : hospital_dependency, db : db_dependency, File : UploadFile = File(...)):
    policy = await add_document(db, hospital.id, "hospital", File, "POLICY")
    return {
        "note" : "Policy uploaded successfully"
    }

@router.post("/merge-account/{doctor_id}", status_code = 200)
async def merge_accounts(hospital : hospital_dependency, db : db_dependency, doctor_id : int):
    hos = db.query(Hospitals).filter(Hospitals.id == hospital.id).first()
    if not hos:
        raise HTTPException(404, "Hospital not found")
    doctor = db.query(Doctors).filter(Doctors.id == doctor_id, Doctors.hospital_id == hospital.id).first()
    if not doctor:
        raise HTTPException(404, "Wrong Doctor ID or Doctor not found")
    doctor_wallet = db.query(Wallet).filter(Wallet.user_id == doctor_id, Wallet.role == "doctor").first()
    if not doctor_wallet:
        raise HTTPException(404, f"Doctor {doctor.name}'s wallet is not found")
    if doctor_wallet.id == hos.merged_wallet_id:
        raise HTTPException(400, "Accounts are already merged")
    hospital_wallet = db.query(Wallet).filter(Wallet.user_id == hospital.id, Wallet.role == "hospital").first()
    if hospital_wallet.id == doctor_wallet.id :
        raise HTTPException(400, "Accounts are already merged")
    try : 
        hos.merged_wallet_id = doctor_wallet.id
        db.commit()
    except Exception as e:
        raise HTTPException(500, str(e))

    return {
        "note" : "Accounts merged successfully"
    }

# =====================================================================================
# PUT REQUESTS
# =====================================================================================

@router.put("/profile", status_code = 200)
async def update_profile(request : ProfileRequest, hospital : hospital_dependency):
    result = update_hospital_profile(request.username, request.email, request.address, request.city, request.state, request.zip, request.phone_number, hospital.id)
    return result

@router.put("/policy", status_code = 200)
async def update_policy_document(hospital : hospital_dependency, db : db_dependency, file : UploadFile = File(...)):
    await update_policy(db, hospital.id, "hospital", file)
    return {
        "note": "Policy updated successfully"
    }

@router.put("/charges", status_code = 200)
async def update_charges(charges : float, hospital : hospital_dependency, db : db_dependency):
    hos = db.query(Hospitals).filter(Hospitals.id == hospital.id).first()
    if not hos:
        raise HTTPException(404, "Hospital not found")
    if charges > 50 :
        raise HTTPException(400, "Hospitals can not take charges more than 50%")
    if charges < 0 : 
        raise HTTPException(400, "Charges can not be negative")
    hos.charges = charges * 0.01
    db.commit()
    db.refresh(hos)

    return {
        "note" : "Charges updated successfully",
        "charges" : hos.charges
    }

@router.put("/availibility/{doctor_id}", status_code = 200)
async def change_availibility_of_doctor(
    doctor_id : int, 
    availibility : bool, 
    hospital : hospital_dependency, 
    db : db_dependency,
    background_tasks : BackgroundTasks = BackgroundTasks()
):
    return await set_availibility_for_doctor(doctor_id, hospital.name, availibility)

@router.put("/limit/{doctor_id}", status_code = 200)
async def change_case_limit(
    limit : int, doctor_id : int, 
    hospital : hospital_dependency, 
    db : db_dependency,
    background_tasks : BackgroundTasks = BackgroundTasks()
):
    return await set_limit_for_doctor(doctor_id, hospital.name, limit)

# =====================================================================================
# DELETE REQUESTS
# =====================================================================================

@router.delete("/doctor/{doctor_id}", status_code = 200)
async def remove_doctor(doctor_id : int, hospital : hospital_dependency, db : db_dependency):
    assigned_users = db.query(AssignedDoctors).filter(AssignedDoctors.doctor_id == doctor_id).all()
    if assigned_users:
        raise HTTPException(400, "Doctor has assigned users")
    
    doctor = db.query(Doctors).filter(Doctors.id == doctor_id, Doctors.hospital_id == hospital.id).first()
    if not doctor:
        raise HTTPException(404, "Doctor not found")
    
    db.delete(doctor)
    db.commit()
    
    return {
        "NOTE" : f"Removed doctor : {doctor.name} with id : {doctor.id} successfully"
    }

