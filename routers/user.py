from decimal import Decimal
import os
from pydantic import BaseModel, Field, field_validator, EmailStr
from urllib.parse import urljoin
from typing import List, Optional
from datetime import date, datetime
from services.payment import handle_payment, handle_refund
from sqlalchemy.orm.attributes import flag_modified
from services.notification import create_notification
from utils.signed_url_generator import generate_signed_url
from utils.dependencies import user_dependency, db_dependency
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from utils.distance_user_hospital import find_n_nearby_doctors
from models import Hospitals, Users, Appointments, Doctors, Symptoms, AssignedDoctors, UserPayments, Cases, Documents
from sqlalchemy import any_, text

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
        from datetime import datetime, timezone

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
async def see_profile(user : user_dependency, db : db_dependency):
    return {
        "name" : user.name,
        "email" : user.email,
        "google_email_id" : user.google_email_id if user.google_email_id else "Google account is not connected"
    }

@router.get("/cases", status_code = 200)
async def get_my_cases(
    user : user_dependency, 
    db : db_dependency,
    status : Optional[str] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(4, ge = 1, le = 100),
    from_date : Optional[datetime] = None,
    to_date : Optional[datetime] = None,
    doctor_id : Optional[int] = None,
    case_id : Optional[int] = None
):
    query = db.query(Cases).filter(Cases.user_id == user.id)
    
    if not case_id:
        if status:
            query = query.filter(Cases.status == status)
        if from_date:
            query = query.filter(Cases.date >= from_date)
        if to_date:
            query = query.filter(Cases.date <= to_date)
        if doctor_id:
            query = query.filter(Cases.doctor_id == doctor_id)
        
        total = query.count()
        cases = query.order_by(Cases.date.desc()).offset((page - 1) * limit).limit(limit).all()
        
        # Batch fetch all related data
        doctor_ids = list(set([c.doctor_id for c in cases]))
        doctors = {d.id : d.name for d in db.query(Doctors).filter(Doctors.id.in_(doctor_ids)).all()}
        
        hospital_ids = list(set([c.hospital_id for c in cases]))
        hospitals = {h.id : h.name for h in db.query(Hospitals).filter(Hospitals.id.in_(hospital_ids)).all()}
        
        all_doc_ids = set()
        all_symptom_ids = set()
        for case in cases:
            all_doc_ids.update(case.user_doc_ids or [])
            all_doc_ids.update(case.doctor_doc_ids or [])
            all_symptom_ids.update(case.symptom_ids or [])
        
        # Fetch documents
        documents = db.query(Documents).filter(Documents.id.in_(all_doc_ids)).all() if all_doc_ids else []
        doc_map = {doc.id: {
            "id" : doc.id,
            "url" : urljoin(BASE_URL, await generate_signed_url(doc.document_path, user.id, user.role, doc.id)),
            "type" : doc.type,
            "date" : doc.date.isoformat()
        } for doc in documents}
        
        # Fetch symptoms
        symptoms = db.query(Symptoms).filter(Symptoms.id.in_(all_symptom_ids)).all() if all_symptom_ids else []
        symptom_map = {s.id: s for s in symptoms}
        
        # Build response - ONLY ONE LOOP
        result = []
        for case in cases:
            # Build symptoms for this case
            case_symptoms = []
            if case.symptom_ids:
                for s_id in case.symptom_ids:
                    if s_id in symptom_map:
                        case_symptoms.append({
                            "id" : s_id,
                            "name" : symptom_map.get(s_id).symptom,
                            "severity" : symptom_map.get(s_id).severity
                        })
            
            result.append({
                "id" : case.id,
                "case_id" : case.case_id,
                "status" : case.status,
                "doctor_name" : doctors.get(case.doctor_id),
                "hospital_name" : hospitals.get(case.hospital_id),
                "case_opened_on" : case.date.isoformat(),
                "case_updated_on" : case.last_updated.isoformat() if case.last_updated else None,
                "documents" : {
                    "user" : [doc_map.get(doc_id) for doc_id in (case.user_doc_ids or []) if doc_map.get(doc_id)],
                    "doctor" : [doc_map.get(doc_id) for doc_id in (case.doctor_doc_ids or []) if doc_map.get(doc_id)]
                },
                "symptoms" : case_symptoms ,
                "cost" : case.cost,
                "diesease" : case.diesease
            })
    else:
        case = query.filter(Cases.id == case_id).first()
        if not case:
            raise HTTPException(404, "Case not found")
        
        doctor = db.query(Doctors).filter(Doctors.id == case.doctor_id).first()
        hospital = db.query(Hospitals).filter(Hospitals.id == doctor.hospital_id).first() if doctor else None
        
        all_doc_ids = set(case.user_doc_ids or []) | set(case.doctor_doc_ids or [])
        documents = db.query(Documents).filter(Documents.id.in_(all_doc_ids)).all() if all_doc_ids else []
        doc_map = {doc.id: {
            "id" : doc.id,
            "url" : urljoin(BASE_URL, await generate_signed_url(doc.document_path, user.id, user.role, doc.id)),
            "type" : doc.type,
            "date" : doc.date.isoformat()
        } for doc in documents}
        
        symptom_ids = set(case.symptom_ids or [])
        symptoms = db.query(Symptoms).filter(Symptoms.id.in_(symptom_ids)).all() if symptom_ids else []
        symptom_map = {s.id : s.symptom for s in symptoms}
        
        case_symptoms = []
        if case.symptom_ids:
            for s_id in case.symptom_ids:
                if s_id in symptom_map:
                    case_symptoms.append({
                        "id" : s_id,
                        "name" : symptom_map[s_id]
                    })
        
        total = 1
        result = [{
            "id" : case.id,
            "case_id" : case.case_id,
            "status" : case.status,
            "doctor_name" : doctor.name if doctor else None,
            "hospital_name" : hospital.name if hospital else None,
            "case_opened_on" : case.date.isoformat(),
            "case_updated_on" : case.last_updated.isoformat() if case.last_updated else None,
            "documents" : {
                "user" : [doc_map.get(doc_id) for doc_id in (case.user_doc_ids or []) if doc_map.get(doc_id)],
                "doctor" : [doc_map.get(doc_id) for doc_id in (case.doctor_doc_ids or []) if doc_map.get(doc_id)]
            },
            "symptoms" : case_symptoms,
            "cost" : case.cost,
            "diesease" : case.diesease
        }]
    
    return {
        "total" : total,
        "limit" : limit,
        "page"  : page,
        "cases" : result
    }

@router.get("/appointment", status_code = 200)
async def appointments(
    user : user_dependency, 
    db : db_dependency, 
    status : Optional[str] = None, 
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    query = db.query(Appointments).filter(Appointments.user_id == user.id)
    
    if status:
        query = query.filter(Appointments.status == status)
    appointments = query.offset((page - 1) * limit).limit(limit).all()
    
    if not appointments:
        return []
    
    doctor_ids = [app.doctor_id for app in appointments]
    case_ids = [app.case_id for app in appointments if app.case_id]
    
    doctors = {d.id: d for d in db.query(Doctors).filter(Doctors.id.in_(doctor_ids)).all()}
    
    hospital_ids = [d.hospital_id for d in doctors.values()]
    hospitals = {h.id: h for h in db.query(Hospitals).filter(Hospitals.id.in_(hospital_ids)).all()}
    
    cases = {c.id: c for c in db.query(Cases).filter(Cases.id.in_(case_ids)).all()} if case_ids else {}
    
    data = []
    for appointment in appointments:
        doctor = doctors.get(appointment.doctor_id)
        hospital = hospitals.get(doctor.hospital_id) if doctor else None
        case = cases.get(appointment.case_id)
        
        data.append({
            "id" : appointment.id,
            "date" : appointment.date.isoformat(),
            "status" : appointment.status,
            "doctor_id" : appointment.doctor_id,
            "doctor_name" : doctor.name if doctor else "Unknown",
            "doctor_phone_number" : doctor.phone_number if doctor else "Unknown",
            "doctor_email" : doctor.email if doctor else "Unknown",
            "case_id" : case.case_id if case else None,
            "hospital_name" : hospital.name if hospital else "Unknown",
            "address" : f"{hospital.address}, {hospital.city}, {hospital.state}, {hospital.zip}" if hospital else "Unknown"
        })
    
    return data

@router.get("/doctors/", status_code=200)
async def see_all_doctors(
    user : user_dependency, 
    db : db_dependency, 
    doctor_name : Optional[str] = None, 
    hospital_name : Optional[str] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    # Start with base queries
    hospital_query = db.query(Hospitals)
    doctor_query = db.query(Doctors).filter(Doctors.is_active == True)
    
    # Filter by hospital name if provided
    if hospital_name:
        hospital = hospital_query.filter(Hospitals.name.ilike(hospital_name)).first()
        if not hospital:
            raise HTTPException(404, f"Hospital not found: {hospital_name}")
        hospitals = [hospital]
    else:
        hospitals = hospital_query.offset((page - 1) * limit).limit(limit).all()
    
    if not hospitals:
        raise HTTPException(404, "No hospitals found")
    
    # Get all hospital IDs
    hospital_ids = [h.id for h in hospitals]
    
    # Get all doctors from these hospitals
    doctor_query = doctor_query.filter(Doctors.hospital_id.in_(hospital_ids))
    
    # Filter by doctor name if provided
    if doctor_name:
        doctor_query = doctor_query.filter(Doctors.name.ilike(doctor_name))
    
    doctors = doctor_query.all()
    
    # Group doctors by hospital_id
    doctors_by_hospital = {}
    for doctor in doctors:
        if doctor.hospital_id not in doctors_by_hospital:
            doctors_by_hospital[doctor.hospital_id] = []
        doctors_by_hospital[doctor.hospital_id].append(doctor)
    
    # Build the response
    data = []
    for hospital in hospitals:
        hospital_doctors = doctors_by_hospital.get(hospital.id, [])
        
        # Skip hospitals with no doctors if doctor_name filter is applied
        if doctor_name and not hospital_doctors:
            continue
            
        data.append({
            "hospital_id" : hospital.id,
            "hospital_name" : hospital.name,
            "hospital_address" : f"{hospital.address}, {hospital.city}, {hospital.state}, {hospital.zip}",
            "hospital_lat" : hospital.lat,
            "hospital_lon" : hospital.lon,
            "hospital_phone_number" : hospital.phone_number,
            "doctors" : [{
                "id" : doctor.id,
                "name" : doctor.name,
                "email" : doctor.email,
                "phone_number" : doctor.phone_number,
                "availibility" : doctor.availability,
                "specialty" : doctor.specialty,
                "google_email_id" : doctor.google_email_id if doctor.google_email_id else "Google account is not connected",
                "fees" : doctor.fees,
                "appointment_fees" : doctor.appointment_fees
            } for doctor in hospital_doctors]
        })
    
    return data
    
@router.get("/my-doctors/", status_code = 200)
async def my_doctors(
    user : user_dependency, 
    db : db_dependency, 
    doctor_name : Optional[str] = None, 
    hospital_name : Optional[str] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    query = db.query(AssignedDoctors).filter(AssignedDoctors.user_id == user.id)
    
    if doctor_name:
        doctor = db.query(Doctors).filter(Doctors.name == doctor_name.title()).first()
        if not doctor:
            raise HTTPException(404, f"Doctor not found named {doctor_name}")
        query = query.filter(AssignedDoctors.doctor_id == doctor.id)
    
    if hospital_name:
        hospital = db.query(Hospitals).filter(Hospitals.name == hospital_name.title()).first()
        if not hospital:
            raise HTTPException(404, f"Hospital not found named {hospital_name}")
        hospital_doctor_ids = [d.id for d in db.query(Doctors.id).filter(Doctors.hospital_id == hospital.id).all()]
        if not hospital_doctor_ids:
            raise HTTPException(404, f"No doctors found in {hospital_name}")
        query = query.filter(AssignedDoctors.doctor_id.in_(hospital_doctor_ids))
    
    assigned_doctors = query.offset((page - 1) * limit).limit(limit).all()
    
    if not assigned_doctors:
        raise HTTPException(404, "No assigned doctors found")
    
    doctor_ids = [ad.doctor_id for ad in assigned_doctors]
    doctors = {d.id: d for d in db.query(Doctors).filter(Doctors.id.in_(doctor_ids)).all()}
    
    hospital_ids = [d.hospital_id for d in doctors.values()]
    hospitals = {h.id: h for h in db.query(Hospitals).filter(Hospitals.id.in_(hospital_ids)).all()}
    
    cases = {
        c.doctor_id: c 
        for c in db.query(Cases).filter(Cases.user_id == user.id, Cases.doctor_id.in_(doctor_ids), Cases.status == "OPEN").all()
    }
    
    data = []
    for assigned in assigned_doctors:
        doctor = doctors.get(assigned.doctor_id)
        if not doctor:
            continue
            
        hospital = hospitals.get(doctor.hospital_id)
        case = cases.get(doctor.id)
        
        data.append({
            "doctor_id" : doctor.id,
            "name" : doctor.name,
            "email" : doctor.email,
            "phone_number" : doctor.phone_number,
            "fees" : doctor.fees,
            "appointment_fees" : doctor.appointment_fees,
            "id" : case.id if case else None,
            "case_id" : case.case_id if case else None,
            "diesease" : case.diesease if case else None,
            "specialty" : doctor.specialty,
            "hospital" : hospital.name if hospital else None,
            "hospital_id" : doctor.hospital_id,
            "hospital_lat" : hospital.lat if hospital else None,
            "hospital_lon" : hospital.lon if hospital else None
        })
    
    return data

@router.get("/symptom", status_code = 200)
async def symptoms(user : user_dependency, db : db_dependency, date : Optional[date] = None, page : int = Query(1, ge = 1), limit : int = Query(20, ge = 1, le = 100)):
    query = db.query(Symptoms).filter(Symptoms.user_id == user.id)
    
    if date is not None:
        start_of_day = datetime.combine(date, datetime.min.time())
        end_of_day = datetime.combine(date, datetime.max.time())
        query = query.filter(Symptoms.date >= start_of_day, Symptoms.date <= end_of_day)
    
    symptoms = query.offset((page - 1) * limit).limit(limit).all()
    
    return [
        {
            "id": s.id,
            "symptom": s.symptom,
            "severity": s.severity,
            "date": s.date.isoformat()
        }
        for s in symptoms
    ]
 
@router.get("/nearby-doctors/{n}", status_code = 200)
async def get_nearby_doctors(user : user_dependency, db : db_dependency, n : int):
    user = db.query(Users).filter(Users.id == user.id).first()
    # TODO : add logic to search only for the doctor which specialize in the field of user's diesease
    results = await find_n_nearby_doctors(user, db, n)
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
    db : db_dependency, 
    type : Optional[str] = None, 
    date : Optional[date] = None, 
    page : int = Query(1, ge=1), 
    limit : int = Query(20, ge=1, le=100)
):
    query = db.query(UserPayments).filter(UserPayments.user_id == user.id,  UserPayments.role == "user")

    if type:
        query = query.filter(UserPayments.type == type.upper())

    if date:
        start_of_day = datetime.combine(date, datetime.min.time())
        end_of_day = datetime.combine(date, datetime.max.time())
        query = query.filter(UserPayments.date >= start_of_day,  UserPayments.date <= end_of_day)

    transactions = query.order_by(UserPayments.date.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return [
        {
            "id" : transaction.id,
            "date" : transaction.date.isoformat() if transaction.date else None,
            "amount" : transaction.amount,
            "type" : transaction.type,
            "note" : transaction.note
        }
        for transaction in transactions
    ]

@router.get("/policy/{hospital_id}", status_code = 200)
async def get_hospital_policy_details(hospital_id : int, user : user_dependency, db : db_dependency):
    policies = db.query(Documents).filter(Documents.role == "hospital", Documents.user_id == hospital_id, Documents.type == "POLICY").all()
    if not policies:
        raise HTTPException(status_code = 404, detail = "No policies found")
    data = []
    for policy in policies :
        data.append({
            "id" : policy.id,
            "file_name" : policy.document_path.split("/")[-1] if policy.document_path else "Policy Document",
            "url" : urljoin(BASE_URL, await generate_signed_url(policy.document_path, user_id = user.id, user_role = "user", doc_id = policy.id)),
            "uploaded_at" : policy.date.isoformat() if policy.date else None
        })
    return data

# =====================================================================================
# POST REQUESTS
# =====================================================================================

@router.post("/symptom", status_code = 201)
async def symptom(request : Symptom_request, user : user_dependency, db : db_dependency, case_id : Optional[int] = None, background_tasks : BackgroundTasks = BackgroundTasks()):
    symptom = Symptoms(
        user_id = user.id, 
        symptom = request.symptom, 
        severity = request.severity
    )
    db.add(symptom)
    db.flush()
    ids = [symptom.id]
    
    if case_id:
        case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user.id).first()
        if not case:
            db.rollback()  # Rollback the symptom we just added
            raise HTTPException(status_code = 404, detail = "Case not found")
        
        # Initialize symptom_ids if None
        if case.symptom_ids is None:
            case.symptom_ids = []
        
        case.symptom_ids = case.symptom_ids + [symptom.id]
        case.last_updated = datetime.now()
        doctor = db.query(Doctors).filter(Doctors.id == case.doctor_id).first()
        
        db.commit()
        db.refresh(case)

        # notify doctor
        if doctor:
            background_tasks.add_task(
                create_notification,
                message = f"Your case with case_id {case.case_id} has been closed by doctor {doctor.name}", 
                recipient_id = case.user_id, 
                recipient_role = "user"
            )

        return {
            "note": "Symptom added successfully to case",
            "symptom": symptom.symptom,
            "severity": symptom.severity,
            "case_id": case.id,
            "doctor_name": doctor.name if doctor else "Unknown",
            "date": symptom.date.date(),
            "time": symptom.date.time()
        }
    
    db.commit()
    
    return {
        "note": "Symptom added successfully",
        "symptom": symptom.symptom,
        "severity": symptom.severity,
        "date": symptom.date.date(),
        "time": symptom.date.time()
    }

@router.post("/assign/{doctor_id}", status_code = 200)
async def assign_doctor(doctor_id : int, user : user_dependency, db : db_dependency, note : str = None, background_tasks : BackgroundTasks = BackgroundTasks()):
    is_assigned = db.query(AssignedDoctors).filter(AssignedDoctors.user_id == user.id, AssignedDoctors.doctor_id == doctor_id).first()
    is_case = db.query(Cases).filter(Cases.doctor_id == doctor_id, Cases.user_id == user.id, Cases.status == "OPEN").first()
    if is_assigned:
        raise HTTPException(status_code = 400, detail = "You are already assigned to this doctor")
    if is_case:
        raise HTTPException(status_code = 400, detail = "You already have an open case with this doctor")
    # assign a doctor
    assigned = AssignedDoctors(
        user_id = user.id, 
        doctor_id = doctor_id,
        date = datetime.now()
    )
    db.add(assigned)

    doctor = db.query(Doctors).filter(Doctors.id == doctor_id, Doctors.is_active == True).first()
    if not doctor:
        raise HTTPException(status_code = 404, detail = "Doctor not found")
    if doctor.availability == False:
        raise HTTPException(status_code = 400, detail = "Doctor is not available")
    result = await handle_payment(db, user.id, user.role, doctor_id, "doctor", doctor.fees, note = f"Fees of doctor {doctor.name}")
    
    # add a case
    hospital = db.query(Hospitals).filter(Hospitals.id == doctor.hospital_id).first()
    if not hospital:
        raise HTTPException(status_code = 404, detail = "Hospital not found")
    case = Cases(
        case_id = hospital.cases + 1,
        user_id = user.id, 
        doctor_id = doctor_id,
        hospital_id = hospital.id,
        status = "OPEN",
        cost = doctor.fees
    )
    db.add(case)

    # update case count
    hospital.cases += 1

    db.commit()
    db.refresh(assigned)
    db.refresh(case)

    # send notification to doctor
    background_tasks.add_task(
        create_notification,
        message = f"You have been assigned to case {case.case_id} for user {user.name}", 
        recipient_id = case.doctor_id, 
        recipient_role = "doctor"
    )

    background_tasks.add_task(
        create_notification,
        message = f"You have been sucessfully assigned to doctor {doctor.name}", 
        recipient_id = user.id, 
        recipient_role = "user"
    )

    return {
        "note" : "Doctor assigned successfully",
        "assigned_doctor_id" : assigned.doctor_id,
        "doctor_name" : doctor.name,
        "case" : case.id,
        "case_id" : case.case_id,
        "fees" : doctor.fees,
        "transaction_id" : result["transaction_id"] if result else None,
        "user_id" : user.id
    }

@router.post("/appointment", status_code=201)
async def book_appointment(request: AppointmentRequest, user: user_dependency, db: db_dependency):
    case = db.query(Cases).filter(Cases.doctor_id == request.doctor_id, Cases.user_id == user.id, Cases.status == "OPEN").first()
    if not case:
        raise HTTPException(status_code = 404, detail = "Case not found")

    doctor = db.query(Doctors).filter(Doctors.id == request.doctor_id, Doctors.is_active == True).first()
    if not doctor:
        raise HTTPException(status_code = 404, detail = "Doctor not found")
    if not doctor.availability:
        raise HTTPException(status_code = 400, detail = "Doctor is not available")

    doctor_name = doctor.name
    doctor_appointment_fees = doctor.appointment_fees
    doctor_fees = doctor.fees  
    new_appointment = Appointments(
        user_id = user.id,
        doctor_id = request.doctor_id,
        case_id = case.id,
        date = request.date,
        status = "PENDING"
    )

    case.last_updated = datetime.now()

    result = await handle_payment(
        db,
        user.id,
        user.role,
        request.doctor_id,
        "doctor",
        doctor_fees,
        note = f"Appointment Fees of doctor {doctor_name}"
    )

    db.add(new_appointment)
    db.commit()
    db.refresh(new_appointment)

    await create_notification(
        message = f"You have a new appointment request from user {user.name}",
        recipient_id = request.doctor_id,
        recipient_role = "doctor"
    )

    return {
        "note" : f"Appointment Booked for doctor {doctor_name} Successfully",
        "transaction_id" : result["transaction_id"] if result else None,
        "amount" : doctor_appointment_fees,
        "message" : "You will get a confirmation mail from our side before 24 hours of appointment. Please keep checking your email for updates."
    }

# =====================================================================================
# PUT REQUESTS
# =====================================================================================

@router.put("/upgrade", status_code = 200)
async def upgrade_user(user : user_dependency, db : db_dependency, background_tasks : BackgroundTasks = BackgroundTasks()):
    result = await handle_payment(user.id, user.role, 1, "admin", PRIMIUM_PLAN_FEES, note = f"Buying PREMIUM PLAN", type = "OUTGOING")

    background_tasks.add_task(
        create_notification,
        message = f"You have been successfully upgraded to PREMIUM PLAN user", 
        recipient_id = user.id, 
        recipient_role = "user"
    )

    return result

@router.put("/reopen/{case_id}", status_code = 200)
async def reopen_case(case_id : int, user : user_dependency, db : db_dependency, background_tasks : BackgroundTasks = BackgroundTasks()):
    case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user.id, Cases.status == "CLOSED").first()
    if not case:
        raise HTTPException(status_code = 404, detail = "Case not found or maybe already open")
    case.status = "OPEN"

    # check when was the case last modified
    last_updated = case.last_updated
    doctor = db.query(Doctors).filter(Doctors.id == case.doctor_id, Doctors.is_active == True).first()
    if not doctor:
        raise HTTPException(status_code = 404, detail = "Doctor not found")
    if doctor.availability == False :
        raise HTTPException(status_code = 400, detail = "Doctor is not available")
    # if it was last updated under 6 month ago then take half fees, otherwise it would cost full fees
    days = (datetime.now() - last_updated).days
    if days < 180:
        amount = amount = Decimal(doctor.fees) * Decimal('0.5')
    else:
        amount = Decimal(doctor.fees) 
    
    case.cost += amount

    result = await handle_payment(db, user.id, user.role, case.doctor_id, "doctor", amount, note = f"Reopening case {case.case_id} for doctor {doctor.name}")
    if not result:
        case.cost -= amount
        raise HTTPException(status_code = 400, detail = "Payment failed")
    
    case.last_updated = datetime.now()
    db.commit()
    db.refresh(case)

    background_tasks.add_task(
        create_notification,
        message = f"Your case with case_id {case.case_id} has been reopened by user {user.name}", 
        recipient_id = case.doctor_id, 
        recipient_role = "doctor"
    )
    return {
        "note" : "Case reopened successfully",
        "case_id" : case.case_id
    }

@router.put("/cases/{case_id}/symptoms", status_code = 200)
async def add_symptoms_to_case(case_id : int, user : user_dependency, db : db_dependency, request : SymptomIDsRequest, background_tasks : BackgroundTasks = BackgroundTasks()):
    if not request.symptom_ids:
        raise HTTPException(status_code = 400, detail = "Please provide at least one symptom id")
    case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code = 404, detail = "Case not found")
    for symptom_id in request.symptom_ids:
        symptom = db.query(Symptoms).filter(Symptoms.id == symptom_id, Symptoms.user_id == user.id).first()
        if not symptom:
            raise HTTPException(status_code = 404, detail = f"Symptom not found for symptom : {symptom_id}")
        if symptom_id in case.symptom_ids:
            raise HTTPException(status_code = 400, detail = f"Symptom with id {symptom_id} is already added to the case")
        case.symptom_ids = case.symptom_ids + [symptom_id] if case.symptom_ids else [symptom_id]

    case.last_updated = datetime.now()
    db.commit()
    db.refresh(case)
    background_tasks.add_task(
        create_notification,
        message = f"user {user.name} has a new added symptoms to case {case.case_id}", 
        recipient_id = case.doctor_id, 
        recipient_role = "doctor"
    )
    return {
        "note" : "Symptoms added successfully to case",
        "case" : case.id,
        "case_id" : case.case_id,
        "symptom_ids" : case.symptom_ids
    }

@router.put("/cases/{case_id}/documents", status_code = 200)
async def add_documents_to_case(case_id : int, user : user_dependency, db : db_dependency, request : DocumentIDsRequest, background_tasks : BackgroundTasks = BackgroundTasks()):
    if not request.document_ids:
        raise HTTPException(status_code = 400, detail = "Please provide at least one document id")
    case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code = 404, detail = "Case not found")
    
    for document_id in request.document_ids:
        if document_id in case.user_doc_ids :
            raise HTTPException(status_code = 400, detail = f"Document with id {document_id} is already added to the case")
        document = db.query(Documents).filter(Documents.id == document_id, Documents.user_id == user.id).first()
        if not document:
            raise HTTPException(status_code = 404, detail = f"Document not found for document : {document_id}")
        case.user_doc_ids = case.user_doc_ids + [document_id] if case.user_doc_ids else [document_id]
    
    case.last_updated = datetime.now()
    db.commit()
    db.refresh(case)
    background_tasks.add_task(
        create_notification,
        message = f"user {user.name} has a new added document to case {case.case_id}", 
        recipient_id = case.doctor_id, 
        recipient_role = "doctor"
    )
    return {
        "note" : "Documents added successfully to case",
        "case" : case.id,
        "case_id" : case.case_id,
        "user_document_ids" : case.user_doc_ids,
        "doctor_document_ids" : case.doctor_doc_ids
    }

@router.put("/cases/close/{case_id}", status_code = 200)
async def close_case(case_id : int, user : user_dependency, db : db_dependency, background_tasks : BackgroundTasks = BackgroundTasks()):
    case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user.id, Cases.status != "CLOSED").first()
    if not case:
        raise HTTPException(status_code = 404, detail = "Case not found")
    
    if case.status == "REQUESTED_BY_DOCTOR":
        case.status = "CLOSED"
        background_tasks.add_task(
            create_notification,
            message = f"user {user.name} has closed the case {case.case_id}", 
            recipient_id = case.doctor_id, 
            recipient_role = "doctor"
        )
    elif case.status == "OPEN":
        case.status = "REQUESTED_BY_USER"
        background_tasks.add_task(
            create_notification,
            message = f"user {user.name} has requested to close the case {case.case_id}", 
            recipient_id = case.doctor_id, 
            recipient_role = "doctor"
        )
    elif case.status not in ["REQUESTED_BY_USER", "REQUESTED_BY_DOCTOR", "CLOSED"]:
        raise HTTPException(status_code = 400, detail = "Invalid status")
    
    # deassign the doctor
    doctor_id = case.doctor_id
    assigned = db.query(AssignedDoctors).filter(AssignedDoctors.user_id == user.id, AssignedDoctors.doctor_id == doctor_id).first()
    if assigned:
        db.delete(assigned)

    case.last_updated = datetime.now()
    db.commit()
    db.refresh(case)
    return {
        "note" : "Case closed successfully" if case.status == "CLOSED" else "Case closure requested successfully",
        "case" : case.id,
        "case_id" : case.case_id,
        "status" : case.status,
    }

@router.put("/profile", status_code = 200)
async def update_profile(request : ProfileRequest, user : user_dependency, db : db_dependency):

    db_user = db.query(Users).filter(Users.id == user.id).first()

    db_user.name = request.username
    db_user.email = request.email

    db.commit()
    db.refresh(db_user)

    return {
        "note": "Profile updated successfully",
        "username": db_user.name,
        "email": db_user.email
    }

@router.put("/symptom", status_code = 200)
async def update_symptom(symptom_id : int, request : Symptom_request, user : user_dependency, db : db_dependency):
    symptom = db.query(Symptoms).filter(Symptoms.id == symptom_id, Symptoms.user_id == user.id).first()
    if not symptom:
        raise HTTPException(status_code = 404, detail = "Symptom not found")

    symptom.symptom = request.symptom
    symptom.severity = request.severity 

    db.commit()
    db.refresh(symptom)

    return {
        "note" : "Symptom updated successfully",
        "id" : symptom.id,
        "symptom" : symptom.symptom,
        "severity" : symptom.severity
    }

@router.put("/appointment/{appointment_id}", status_code = 200)
async def update_appointment(appointment_id : int, request : AppointmentRequest, user : user_dependency, db : db_dependency, background_tasks : BackgroundTasks = BackgroundTasks()):
    appointment = db.query(Appointments).filter(Appointments.id == appointment_id, Appointments.user_id == user.id).first()
    if not appointment:
        raise HTTPException(status_code = 404, detail = "Appointment not found")

    appointment.doctor_id = request.id
    appointment.date = request.date

    db.commit()
    db.refresh(appointment)
    background_tasks.add_task(
        create_notification,
        message = f"user {user.name} has the appointment of case {appointment.case_id}", 
        recipient_id = appointment.doctor_id, 
        recipient_role = "doctor"
    )
    return {
        "note" : "Appointment updated successfullys",
        "id" : appointment.id,
        "doctor_id" : appointment.doctor_id,
        "date" : appointment.date.isoformat()
    }

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
async def change_transaction_note(transaction_id : int, note : str, user : user_dependency, db : db_dependency):
    transaction = db.query(UserPayments).filter(UserPayments.id == transaction_id, UserPayments.user_id == user.id).first()
    if not transaction:
        raise HTTPException(status_code = 404, detail = "Transaction not found")

    transaction.note = note
    db.commit()
    db.refresh(transaction)

    return {
        "note" : "Transaction note updated successfully",
        "id" : transaction.id,
        "note" : transaction.note
    }

# =====================================================================================
# DELETE REQUESTS
# =====================================================================================

@router.delete("/cases/symptom/{case_id}/{symptom_id}")
async def remove_symptom_from_case(case_id : int, symptom_id : int, user : user_dependency, db : db_dependency):
    case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user.id, Cases.status == "OPEN").first()
    if not case:
        raise HTTPException(404, "Case not found")
    
    case.last_updated = datetime.now()
    if case.symptom_ids and symptom_id in case.symptom_ids:
        # case.symptom_ids.remove(symptom_id)
        case.symptom_ids = [i for i in case.symptom_ids if i != symptom_id]
        db.commit()
    
    return {
        "note" : f"Symptom {symptom_id} removed from case"
    }

@router.delete("/cases/document/{case_id}/{document_id}")
async def remove_document_from_case(case_id : int, document_id : int, user : user_dependency, db : db_dependency, background_tasks : BackgroundTasks = BackgroundTasks()):
    case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user.id, Cases.status == "OPEN").first()
    if not case:
        raise HTTPException(404, "Case not found")
    
    if case.user_doc_ids and document_id in case.user_doc_ids:
        case.user_doc_ids = [id for id in case.user_doc_ids if id != document_id]
        case.last_updated = datetime.now()
        db.commit()
        background_tasks.add_task(
            create_notification,
            message = f"user {user.name} has removed document {document_id} from the case {case.case_id}", 
            recipient_id = case.doctor_id, 
            recipient_role = "doctor"
        )
    
    return {
        "note" : f"Document {document_id} removed from case"
    }
    
@router.delete("/symptom/{symptom_id}", status_code=200)
async def delete_symptom(
    symptom_id: int, 
    user: user_dependency, 
    db: db_dependency, 
    force: bool = False, 
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    # Find the symptom
    symptom = db.query(Symptoms).filter(
        Symptoms.id == symptom_id, 
        Symptoms.user_id == user.id
    ).first()
    if not symptom:
        raise HTTPException(status_code=404, detail="Symptom not found")

    # FIXED: Query cases where symptom_id exists in the INTEGER[] array
    cases = db.query(Cases).filter(
        any_(Cases.symptom_ids) == symptom_id
    ).all()
    
    if cases and not force:
        case_ids = [c.case_id for c in cases]
        raise HTTPException(
            status_code=400, 
            detail=f"Symptom is attached to {len(cases)} case(s): {case_ids}. Use ?force=true to delete anyway."
        )
    
    # Remove symptom from each case's INTEGER[] array
    for case in cases:
        if case.symptom_ids:
            # Filter out the symptom_id from the array
            case.symptom_ids = [
                sid for sid in case.symptom_ids 
                if sid != symptom_id
            ]
            # CRITICAL: Notify SQLAlchemy that the array was modified in-place
            flag_modified(case, "symptom_ids")
            case.last_updated = datetime.now()
    
    # Delete the symptom
    db.delete(symptom)
    
    # Single commit for all changes
    db.commit()

    # Handle notification in background task
    background_tasks.add_task(
        create_notification,
        message = f"User {user.name} has deleted symptom {symptom_id}",
        recipient_id = symptom.doctor_id if hasattr(symptom, 'doctor_id') else None,
        recipient_role = "doctor"
    )

    return {
        "note": "Symptom deleted successfully",
        "id": symptom_id,
        "cases_affected": len(cases)
    }

@router.delete("/appointment/{appointment_id}", status_code = 200)
async def cancel_appointment(appointment_id : int, user : user_dependency, db : db_dependency, background_tasks : BackgroundTasks = BackgroundTasks()):
    appointment = db.query(Appointments).filter(Appointments.id == appointment_id, Appointments.user_id == user.id).first()
    if not appointment:
        raise HTTPException(status_code = 404, detail = "Appointment not found")
    
    if appointment.status == "CANCELLED":
        raise HTTPException(status_code = 400, detail = "Appointment already cancelled")

    if appointment.date < datetime.now():
        raise HTTPException(status_code = 400, detail = "Cannot cancel an appointment in the past")

    # remove the price from case's cost
    case = db.query(Cases).filter(Cases.id == appointment.case_id).first()
    doctor = db.query(Doctors).filter(Doctors.id == appointment.doctor_id).first()
    case.cost -= doctor.appointment_fees
    case.last_updated = datetime.now()
    db.refresh(case)

    # refund the payment
    await handle_refund(
        db, 
        user.id, 
        user.role, 
        appointment.doctor_id, 
        "doctor", 
        doctor.fees, 
        note = f"Refund for cancelled appointment of case {case.case_id}"
    )

    # Cancel the appointment
    db.delete(appointment)
    db.commit()

    background_tasks.add_task(
        create_notification,
        message = f"user {user.name} has cancelled an appointment {appointment_id} of time {appointment.date}", 
        recipient_id = appointment.doctor_id, 
        recipient_role = "doctor"
    )

    return {
        "note" : "Appointment cancelled successfully",
        "id" : appointment_id
    }

@router.delete("/location", status_code = 200)
async def remove_location(user : user_dependency, db : db_dependency):
    user.lat = None
    user.lon = None
    
    db.commit()
    
    return {
        "note" : "Location removed successfully",
        "status" : "success"
    }