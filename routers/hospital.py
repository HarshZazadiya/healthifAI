from fastapi import BackgroundTasks, Query
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from logs.logging import logger
from services.availibility import set_availibility_for_doctor, set_limit_for_doctor
from services.notifcation import create_notification
from utils.helper import bcrypt_context
from utils.hospital_location_getter import hospital_location_getter
from utils.signed_url_generator import generate_signed_url
from fastapi import File, HTTPException, APIRouter, UploadFile
from utils.dependencies import hospital_dependency, db_dependency
from services.document_handling import add_document, update_policy
from models import Cases, DoctorPayments, Hospitals, Doctors, Symptoms, Users, Appointments, AssignedDoctors, Wallet, Documents

router = APIRouter(
    prefix = "/hospital",
    tags = ["hospital"]
)

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
async def see_profile(hospital : hospital_dependency, db : db_dependency):
    hospital = db.query(Hospitals).filter(Hospitals.id == hospital.id).first()
    return {
        "name" : hospital.name,
        "email" : hospital.email,
        "address" : hospital.address,
        "city" : hospital.city,
        "state" : hospital.state,
        "zip" : hospital.zip,
        "phone" : hospital.phone_number
    }

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
    doctors = db.query(Doctors).filter(Doctors.hospital_id == hospital.id)
    if availability :
        doctors = doctors.filter(Doctors.availability == availability)
    if rating :
        doctors = doctors.filter(Doctors.rating == rating)
    if email :
        doctors = doctors.filter(Doctors.email == email)
    if speciality :
        doctors = doctors.filter(Doctors.specialty == speciality.title())
    if name :
        doctors = doctors.filter(Doctors.name == name.title())
    doctors = doctors.offset((page - 1) * limit).limit(limit).all()
    if not doctors:
        raise HTTPException(status_code = 404, detail = "No doctors found")
    data = []
    for doc in doctors :
        data.append({
            "id" : doc.id,
            "name" : doc.name,
            "registered_email" : doc.email,
            "specialty" : doc.specialty,
            "google_email_id" : doc.google_email_id
        })
    return data

@router.get("/users", status_code = 200)
async def get_all_users(
    hospital : hospital_dependency, 
    db : db_dependency,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100),
    status : Optional[str] = None,  # Optional filter
    user_name : Optional[str] = None,
    doctor_name : Optional[str] = None
):
    # Base query
    query = db.query(Cases, Users, Doctors).join(Users, Cases.user_id == Users.id).outerjoin(Doctors, Cases.doctor_id == Doctors.id).filter(Cases.hospital_id == hospital.id)
    
    # Optional status filter
    if status:
        query = query.filter(Cases.status == status)
    if user_name:
        query = query.filter(Users.name == user_name.title())
    if doctor_name:
        query = query.filter(Doctors.name == doctor_name.title())
    
    # Get total count for pagination
    total = query.count()
    
    # Get paginated results
    cases = query.offset((page - 1) * limit).limit(limit).all()
    
    data = []
    for case, user, doctor in cases:
        data.append({
            "user_id" : user.id,
            "user_name" : user.name,
            "user_email" : user.email,
            "user_role" : user.role,
            "doctor_id" : doctor.id if doctor else None,
            "doctor_name" : doctor.name if doctor else "Not assigned",
            "doctor_email" : doctor.email if doctor else None,
            "doctor_specialty" : doctor.specialty if doctor else None,
            "case_id" : case.id,
            "case_disease" : case.diesease,
            "case_status" : case.status,
            "case_date" : case.date.isoformat() if case.date else None,
        })
    
    return {
        "total" : total,
        "page" : page,
        "limit" : limit,
        "data" : data
    }

@router.get("/cases", status_code = 200)
async def get_all_cases(
    hospital : hospital_dependency, 
    db : db_dependency, 
    status : Optional[str] = None, 
    date : Optional[datetime] = None, 
    page : int = Query(1, ge = 1), 
    limit : int = Query(20, ge = 1, le = 100),
    user_name : Optional[str] = None,
    doctor_name : Optional[str] = None
):
    query = db.query(Cases).filter(Cases.hospital_id == hospital.id)
    if status:
        query = query.filter(Cases.status == status)
    if date:
        query = query.filter(Cases.date == date)
    if user_name:
        query = query.join(Users, Cases.user_id == Users.id).filter(Users.name == user_name.title())
    if doctor_name:
        query = query.join(Doctors, Cases.doctor_id == Doctors.id).filter(Doctors.name == doctor_name.title())
    
    total = query.count()
    cases = query.offset((page - 1) * limit).limit(limit).all()
    
    if not cases:
        return {"total": 0, "page": page, "data": []}
    
    user_ids = {c.user_id for c in cases}
    doctor_ids = {c.doctor_id for c in cases if c.doctor_id}
    
    symptom_ids = set()
    doc_ids = set()
    for case in cases:
        if case.symptom_ids:
            symptom_ids.update(case.symptom_ids)
        if case.user_doc_ids:
            doc_ids.update(case.user_doc_ids)
        if case.doctor_doc_ids:
            doc_ids.update(case.doctor_doc_ids)
    
    users = {u.id: u for u in db.query(Users).filter(Users.id.in_(user_ids)).all()} if user_ids else {}
    doctors = {d.id: d for d in db.query(Doctors).filter(Doctors.id.in_(doctor_ids)).all()} if doctor_ids else {}
    symptoms = {s.id: s for s in db.query(Symptoms).filter(Symptoms.id.in_(symptom_ids)).all()} if symptom_ids else {}
    documents = {d.id: d for d in db.query(Documents).filter(Documents.id.in_(doc_ids)).all()} if doc_ids else {}
    
    data = []
    for case in cases:
        user = users.get(case.user_id)
        doctor = doctors.get(case.doctor_id) if case.doctor_id else None
        
        case_symptoms = [symptoms[sid] for sid in case.symptom_ids  if sid in symptoms] if case.symptom_ids else []
        user_docs = [documents[doc_id] for doc_id in case.user_doc_ids  if doc_id in documents] if case.user_doc_ids else []
        doctor_docs = [documents[doc_id] for doc_id in case.doctor_doc_ids  if doc_id in documents] if case.doctor_doc_ids else []
        
        data.append({
            "id" : case.id,
            "user_id" : user.id if user else None,
            "user_name":  user.name if user else "Unknown",
            "user_email" : user.email if user else None,
            "user_google_linked_email" : user.google_email_id if user and user.google_email_id else "Google account is not connected",
            "disease" : case.diesease,
            "doctor_id" : doctor.id if doctor else None,
            "doctor_name" : doctor.name if doctor else "Not assigned",
            "doctor_email" : doctor.email if doctor else None,
            "doctor_google_linked_email" : doctor.google_email_id if doctor and doctor.google_email_id else "Google account is not connected",
            "symptoms" : case_symptoms,
            "user_documents" : user_docs,
            "doctor_documents" : doctor_docs,
            "status" : case.status,
            "date" : case.date.isoformat() if case.date else None
        })
    
    return {
        "total":  total,
        "page" : page,
        "limit" : limit,
        "data" : data
    }

@router.get("/doctor-balance", status_code = 200)
async def get_doctors_balance(
    hospital : hospital_dependency, 
    db : db_dependency, 
    page : int = Query(1, ge = 1), 
    limit : int = Query(20, ge = 1, le = 100),
    doctor_name : Optional[str] = None
):
    doctors = db.query(Doctors).filter(Doctors.hospital_id == hospital.id)
    if doctor_name:
        doctors = doctors.filter(Doctors.name == doctor_name.title())
    doctors = doctors.offset((page - 1) * limit).limit(limit).all()
    if not doctors:
        raise HTTPException(404, "No doctors found")
    doctor_ids = [doctor.id for doctor in doctors]
    wallets = db.query(Wallet).filter(Wallet.user_id.in_(doctor_ids), Wallet.role == "doctor").all()
    if not wallets:
        raise HTTPException(404, "Wallets not found")
    wallet_map = {wallet.user_id : wallet for wallet in wallets}
    
    data = []
    count = 0
    for doctor in doctors:
        wallet = wallet_map.get(doctor.id)
        if not wallet:
            continue
        data.append({
            "id" : doctor.id,
            "name" : doctor.name,
            "balance" : wallet.balance
        })
        count += 1
    return {
        "doctors_found" : len(doctors),
        "total" : count,
        "data" : data
    }

@router.get("/fees", status_code = 200)
async def get_doctor_fees(hospital : hospital_dependency, db : db_dependency):
    doctors = db.query(Doctors).filter(Doctors.hospital_id == hospital.id).all()
    data = []
    for doctor in doctors:
        data.append({
            "id" : doctor.id,
            "name" : doctor.name,
            "fees" : doctor.fees
        })
    return data

@router.get("/location", status_code = 200)
async def get_hospital_location(hospital : hospital_dependency, db : db_dependency):
    return {"latitude" : hospital.lat, "longitude" : hospital.lon}

@router.get("/appointments", status_code = 200)
async def get_all_appointments(hospital : hospital_dependency, db : db_dependency):
    cases = db.query(Cases).filter(Cases.hospital_id == hospital.id).all()
    if not cases:
        raise HTTPException(404, "No cases found, Hence no Appointments")
    case_ids = [case.id for case in cases]
    appointments = db.query(Appointments).filter(Appointments.case_id.in_(case_ids)).all()
    case_map = {case.id : case for case in cases}
    data = []
    for app in appointments:
        case = case_map.get(app.case_id)
        if not case:
            logger.info(f"Case not found for appointment {app.id}")
            continue
        data.append({
            "id" : app.id,
            "date" : app.date.date(),
            "time" : app.date.time(),
            "case" : case.id,
            "casePid" : case.case_id,
            "diesease" : case.diesease,
            "doctor_info" : [doc.name for doc in db.query(Doctors).filter(Doctors.id == app.doctor_id).all()],
            "user_info" : [user.name for user in db.query(Users).filter(Users.id == app.user_id).all()],
            "status" : app.status
        })
    return data

@router.get("/policy", status_code = 200)
async def get_hospital_policy(hospital : hospital_dependency, db : db_dependency):
    policy = db.query(Documents).filter(Documents.user_id == hospital.id, Documents.role == "hospital", Documents.type == "POLICY").first()
    if not policy:
        raise HTTPException(status_code = 404, detail = "Policy not found, Upload Policy for your hospital")
    return {
        "uploaded_at" : policy.date.isoformat(),
        "url" : await generate_signed_url(policy.document_path, hospital.id, "hospital", policy.id, 1200)
    }

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
    # TODO : add pagination, filter by doctor name
    doctors = db.query(Doctors).filter(Doctors.hospital_id == hospital.id)
    if doctor_name:
        doctors = doctors.filter(Doctors.name == doctor_name.title())
    doctors = doctors.all()
    if not doctors:
        raise HTTPException(404, "No doctors found")

    query = db.query(DoctorPayments).filter(DoctorPayments.doctor_id.in_([doc.id for doc in doctors]))

    if type:
        query = query.filter(DoctorPayments.type == type)
    if date:
        query = query.filter(DoctorPayments.date == date)

    transactions = query.offset((page - 1) * limit).limit(limit).all()

    return [
        {
            "id" : transaction.id,
            "date" : transaction.date.isoformat(),
            "amount" : transaction.amount,
            "type" : transaction.type,
            "note" : transaction.note
        }
        for transaction in transactions
    ]

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
async def update_profile(request : ProfileRequest, hospital : hospital_dependency, db : db_dependency, background_tasks : BackgroundTasks = BackgroundTasks()):
    hospital.name = request.username.title() if request.username else hospital.name
    hospital.email = request.email if request.email else hospital.email
    hospital.address = request.address.title() if request.address else hospital.address
    hospital.city = request.city.title() if request.city else hospital.city
    hospital.state = request.state.title() if request.state else hospital.state
    hospital.zip = request.zip if request.zip else hospital.zip
    hospital.phone_number = request.phone_number if request.phone_number else hospital.phone_number

    db.commit()
    db.refresh(hospital)

    # if address related field was changes then change lat and lon in background task
    if request.address or request.city or request.state or request.zip:
        background_tasks.add_task(
            hospital_location_getter, 
            db, 
            hospital.id
        )
        
    return {
        "note" : "Profile updated successfully",
        "username" : hospital.name,
        "email" : hospital.email,
        "address" : hospital.address,
        "city" : hospital.city,
        "state" : hospital.state,
        "zip" : hospital.zip,
        "phone" : hospital.phone_number
    }

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
    result = await set_availibility_for_doctor(db, doctor_id, availibility)
    users = db.query(AssignedDoctors).filter(AssignedDoctors.doctor_id == doctor_id).all()
    doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
    for user in users:
        background_tasks.add_task(
            create_notification,
            db,
            message = f"Your doctor {doctor.name} availibility has been changed to {availibility} by hospital {hospital.name}",
            recipient_id = user.user_id,
            recipient_role = "user"
        )
    background_tasks.add_task(
        create_notification,
        db,
        message = f"Your availibility has been changed to {availibility} by hospital {hospital.name}",
        recipient_id = doctor_id,
        recipient_role = "doctor"
    )

    return result

@router.put("/limit/{doctor_id}", status_code = 200)
async def change_case_limit(
    limit : int, doctor_id : int, 
    hospital : hospital_dependency, 
    db : db_dependency,
    background_tasks : BackgroundTasks = BackgroundTasks()
):
    result =  await set_limit_for_doctor(db, doctor_id, limit)
    background_tasks.add_task(
        create_notification,
        db,
        message = f"Your case limit has been changed to {limit} by hospital {hospital.name}",
        recipient_id = doctor_id,
        recipient_role = "doctor"
    )

    return result

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