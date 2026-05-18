import os
from typing import Optional
from sqlalchemy import func
from pydantic import BaseModel, EmailStr, Field
from urllib.parse import urljoin
from fastapi import BackgroundTasks, Query
from datetime import datetime, date
from fastapi import APIRouter, HTTPException
from services.notifcation import create_notification
from utils.signed_url_generator import generate_signed_url
from utils.dependencies import doctor_dependency, db_dependency
from models import Cases, Doctors, Documents, Hospitals, Users, Appointments, Symptoms, AssignedDoctors, DoctorPayments

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
    specialty : Optional[str] = Field(min_length = 1, max_length = 100)
    hospital_id : Optional[int] 

class feesChangeRequest(BaseModel):
    fees : Optional[int] = Field(ge = 0)
    appointment_fees : Optional[int] = Field(ge = 0)

# =====================================================================================
# GET REQUESTS
# =====================================================================================

@router.get("/profile", status_code = 200)
async def get_profile(doctor : doctor_dependency, db : db_dependency):
    return {
        "name" : doctor.name,
        "email" : doctor.email,
        "availability" : doctor.availability,
        "specialty" : doctor.specialty
    }

@router.get("/cases", status_code = 200)
async def get_my_cases(
    doctor : doctor_dependency, 
    db : db_dependency,
    status : Optional[str] = None,
    from_date : Optional[datetime] = None,
    to_date : Optional[datetime] = None,
    doctor_id : Optional[int] = None,
    case_id : Optional[int] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100),
):
    query = db.query(Cases).filter(Cases.doctor_id == doctor.id)
    
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
        user_ids = list(set([c.user_id for c in cases]))
        users = {d.id : d.name for d in db.query(Users).filter(Users.id.in_(user_ids)).all()}
        
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
            "url" : urljoin(BASE_URL, await generate_signed_url(doc.document_path, doctor.id, "doctor", doc.id)),
            "type" : doc.type,
            "date" : doc.date.isoformat()
        } for doc in documents}
        
        # Fetch symptoms
        symptoms = db.query(Symptoms).filter(Symptoms.id.in_(all_symptom_ids)).all() if all_symptom_ids else []
        symptom_map = {s.id: s.symptom for s in symptoms}
        
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
                            "name" : symptom_map[s_id]
                        })
            
            result.append({
                "id" : case.id,
                "case_id" : case.case_id,
                "status" : case.status,
                "doctor_name" : users.get(case.doctor_id),
                "case_opened_on" : case.date.isoformat(),
                "case_updated_on" : case.last_updated.isoformat() if case.last_updated else None,
                "documents" : {
                    "user" : [doc_map.get(doc_id) for doc_id in (case.user_doc_ids or []) if doc_map.get(doc_id)],
                    "doctor" : [doc_map.get(doc_id) for doc_id in (case.doctor_doc_ids or []) if doc_map.get(doc_id)]
                },
                "symptoms" : case_symptoms
            })
    else:
        case = query.filter(Cases.id == case_id).first()
        if not case:
            raise HTTPException(404, "Case not found")
        
        user = db.query(Users).filter(Users.id == case.doctor_id).first()
        if not user:
            raise HTTPException(404, "User not found")
        all_doc_ids = set(case.user_doc_ids or []) | set(case.doctor_doc_ids or [])
        documents = db.query(Documents).filter(Documents.id.in_(all_doc_ids)).all() if all_doc_ids else []
        doc_map = {doc.id : {
            "id" : doc.id,
            "url" : urljoin(BASE_URL, await generate_signed_url(doc.document_path, doctor.id, "doctor", doc.id)),
            "type" : doc.type,
            "date" : doc.date.isoformat()
        } for doc in documents}
        
        symptom_ids = set(case.symptom_ids or [])
        symptoms = db.query(Symptoms).filter(Symptoms.id.in_(symptom_ids)).all() if symptom_ids else []
        symptom_map = {s.id: s.symptom for s in symptoms}
        
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
            "user_name" : user.name,
            "case_opened_on" : case.date.isoformat(),
            "case_updated_on" : case.last_updated.isoformat(),
            "documents" : {
                "user" : [doc_map.get(doc_id) for doc_id in (case.user_doc_ids or []) if doc_map.get(doc_id)],
                "doctor" : [doc_map.get(doc_id) for doc_id in (case.doctor_doc_ids or []) if doc_map.get(doc_id)]
            },
            "symptoms" : case_symptoms
        }]
    
    return {
        "total" : total,
        "limit" : limit,
        "page" : page,
        "cases" : result
    }
    
@router.get("/appointment/", status_code = 200)
async def get_appointments(doctor : doctor_dependency,  db : db_dependency,  date : Optional[date] = None,  status : Optional[str] = None,  page : int = 1,  limit : int = 10):
    # Build query with joins to avoid N+1 queries
    query = db.query(Appointments).filter(Appointments.doctor_id == doctor.id)
    
    if date is not None:
        start_of_day = datetime.combine(date, datetime.min.time())
        end_of_day = datetime.combine(date, datetime.max.time())
        query = query.filter(Appointments.date >= start_of_day, Appointments.date <= end_of_day)
    if status is not None:
        query = query.filter(Appointments.status == status)
    appointments = query.order_by(Appointments.date.desc()).offset((page - 1) * limit).limit(limit).all()

    user_ids = [apt.user_id for apt in appointments]
    users = {user.id : user for user in db.query(Users).filter(Users.id.in_(user_ids)).all()}
    
    case_ids = [apt.case_id for apt in appointments if apt.case_id]
    cases = {case.id : case for case in db.query(Cases).filter(Cases.id.in_(case_ids)).all()}
    
    data = []
    for appointment in appointments:
        user = users.get(appointment.user_id)
        case = cases.get(appointment.case_id) if appointment.case_id else None
        
        data.append({
            "id" : appointment.id,
            "date" : appointment.date.isoformat(),
            "status" : appointment.status,
            "user_id" : appointment.user_id,
            "username" : user.name if user else "Unknown",
            "case_id" : appointment.case_id,
            "case_number" : case.case_id if case else None,
        })
    
    return {
        "total" : len(data),
        "appointments" : data
    }

@router.get("/upcoming-appointments", status_code = 200)
async def get_upcoming_appointments(doctor : doctor_dependency,  db : db_dependency):
    today_date = datetime.now().date()
    start_of_day = datetime.combine(today_date, datetime.min.time())
    end_of_day = datetime.combine(today_date, datetime.max.time())
    
    appointments = db.query(Appointments).filter(Appointments.doctor_id == doctor.id, Appointments.date >= start_of_day, Appointments.date <= end_of_day).all()
    
    if not appointments:
        return {
            "total" : 0,
            "appointments" : []
        }
    
    user_ids = list(set([apt.user_id for apt in appointments]))
    case_ids = list(set([apt.case_id for apt in appointments if apt.case_id]))
    
    users = {user.id : user for user in db.query(Users).filter(Users.id.in_(user_ids)).all()}
    cases = {case.id : case for case in db.query(Cases).filter(Cases.id.in_(case_ids)).all()}
    
    data = []
    for appointment in appointments:
        user = users.get(appointment.user_id)
        case = cases.get(appointment.case_id) if appointment.case_id else None
        
        data.append({
            "id" : appointment.id,
            "date" : appointment.date.isoformat(),
            "status" : appointment.status,
            "user_id" : appointment.user_id,
            "username" : user.name if user else "Unknown",
            "case_id" : appointment.case_id,
            "case_number" : case.case_id if case else None
        })
    
    return {
        "total" : len(data),
        "appointments" : data
    }

@router.get("/assigned-users/", status_code = 200)
async def get_assigned_users(doctor : doctor_dependency, db : db_dependency, user_name : Optional[str] = None, page : int = 1, limit : int = 10):
    # see a specific user's info
    query = db.query(AssignedDoctors).filter(AssignedDoctors.doctor_id == doctor.id)
    if user_name :
        user = db.query(Users).filter(Users.name == user_name, Users.role == "user").first()
        if not user:
            raise HTTPException(status_code = 404, detail = "User not found")
        query = query.filter(AssignedDoctors.user_id == user.id)
    assigned_users = query.offset((page - 1) * limit).limit(limit).all()
    # see all assigned user's info
    if assigned_users is None:
        raise HTTPException(status_code = 404, detail = "No assigned users found")
    
    data = []

    assigned_user_ids = [au.user_id for au in assigned_users]
    users = db.query(Users).filter(Users.id.in_(assigned_user_ids)).all()
    if users is None:
        raise HTTPException(status_code = 404, detail = "No users found")   
    user_map = {user.id : user for user in users}

    cases = db.query(Cases).filter(Cases.user_id.in_(assigned_user_ids)).all()
    if cases is None:
        raise HTTPException(status_code = 404, detail = "No cases found")
    case_map = {case.user_id : case for case in cases}
    
    for assigned_user in assigned_users:
        user = user_map.get(assigned_user.user_id)
        case = case_map.get(assigned_user.user_id)
        
        data.append({
            "id" : assigned_user.id,
            "user_id" : assigned_user.user_id,
            "username" : user.name if user else "Unknown",
            "case_id" : case.case_id if case else None,
            "case_opened_at" : case.date if case else None,
            "last_updated" : case.last_updated if case else None
        })

    return data

@router.get("/fees")
async def get_my_fees(doctor : doctor_dependency, db : db_dependency):
    doct = db.query(Doctors).filter(Doctors.id == doctor.id).first()
    return {
        "fees" : doct.fees,
        "appointment_fees" : doct.appointment_fees
    }

@router.get("/hospital", status_code = 200)
async def get_my_hospital_details(doctor : doctor_dependency, db : db_dependency):
    hospital = db.query(Hospitals).filter(Hospitals.id == doctor.hospital_id).first()
    if not hospital:
        raise HTTPException(status_code = 404, detail = "Hospital not found")
    return {
        "name" : hospital.name,
        "email" : hospital.email,
        "address" : hospital.address,
        "city" : hospital.city,
        "state" : hospital.state,
        "zip" : hospital.zip,
        "lat" : hospital.lat,
        "lon" : hospital.lon,
        "phone" : hospital.phone_number,
    }

@router.get("/doctors", status_code = 200)
async def get_all_doctors_under_same_hospital(doctor : doctor_dependency, db : db_dependency):
    doctors = db.query(Doctors).filter(Doctors.hospital_id == doctor.hospital_id).all()
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

@router.get("/transactions/", status_code = 200)
async def show_all_transactions(doctor : doctor_dependency, db : db_dependency, type : Optional[str] = None, date : Optional[datetime] = None, page : int = 1, limit : int = 10):
    query = db.query(DoctorPayments).filter(DoctorPayments.doctor_id == doctor.id)

    # filter by type and date if provided
    if type:
        query = query.filter(DoctorPayments.type == type)
    if date:
        query = query.filter(DoctorPayments.date == date)

    transactions = query.offset((page - 1) * limit).limit(limit).all()
    if not transactions:
        raise HTTPException(status_code = 404, detail = "No transactions found")
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



# =====================================================================================
# PUT REQUESTS
# =====================================================================================

@router.put("/speciality", status_code = 200)
async def change_speciality(speciality : str, doctor : doctor_dependency, db : db_dependency):
    doctor.specialty = speciality.title()
    db.commit()
    db.refresh(doctor)
    return {
        "note" : "Speciality updated successfully",
        "id" : doctor.id,
        "name" : doctor.name,
        "speciality" : doctor.specialty
    }

@router.put("/transactions", status_code = 200)
async def change_transaction_note(transaction_id : int, note : str, doctor : doctor_dependency, db : db_dependency):
    # find the transaction in DoctorPayments table
    transaction = db.query(DoctorPayments).filter(DoctorPayments.id == transaction_id, DoctorPayments.doctor_id == doctor.id).first()
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

@router.put("/cases/{case_id}", status_code = 200)
async def close_case(case_id : int, doctor : doctor_dependency, db : db_dependency, background_tasks : BackgroundTasks = BackgroundTasks()):
    # doctor can only close the case if its assigned to him and is not already closed
    case = db.query(Cases).filter(Cases.id == case_id, Cases.doctor_id == doctor.id, Cases.status != "CLOSED").first()
    # if case is not found then throw an error
    if not case:
        raise HTTPException(status_code = 404, detail = "Case not found, Maybe its already closed")
    if case.status == "REQUESTED_BY_USER":
        case.status = "CLOSED"
        background_tasks.add_task(
            create_notification, 
            message = f"Your case with case_id {case.case_id} has been closed by doctor {doctor.name}", 
            recipient_id = case.user_id, 
            recipient_role = "user"
        )
    elif case.status == "OPEN":
        case.status = "REQUESTED_BY_DOCTOR"
        background_tasks.add_task(
            create_notification,
            message = f"Your case with case_id {case.case_id} has been requested to be closed by doctor {doctor.name}", 
            recipient_id = case.user_id, 
            recipient_role = "user"
        )
    # if case is not in requested by user or open then throw an erro [NOTE  : the close status is already checked when querying the DB.]
    elif case.status not in ["REQUESTED_BY_USER", "OPEN"]:
        raise HTTPException(status_code = 400, detail = "Invalid status")
    db.commit()
    db.refresh(case)
    
    return {
        "case_id" : case.case_id,
        "status" : case.status,
        "total_cost" : case.cost,
        "note" : "Case closed successfully"
    }

@router.put("/profile", status_code = 200)
async def update_profile(request : ProfileRequest, doctor : doctor_dependency, db : db_dependency, background_tasks : BackgroundTasks = BackgroundTasks()):
    # if data is provided then update them otherwise keep the older one
    doctor.name = request.username if request.username else doctor.name
    doctor.email = request.email if request.email else doctor.email
    doctor.hospital_id = request.hospital_id if request.hospital_id else doctor.hospital_id
    doctor.specialty = request.specialty if request.specialty else doctor.specialty
    doctor.availability = request.availability if request.availability else doctor.availability
    

    db.commit()
    db.refresh(doctor)

    # send notification to user assigned to doctor
    users = db.query(AssignedDoctors).filter(AssignedDoctors.doctor_id == doctor.id).all()
    for user in users:
        background_tasks.add_task(
            create_notification, 
            message = f"Your profile has been updated by doctor {doctor.name}", 
            recipient_id = user.user_id, 
            recipient_role = "user"
        )

    return {
        "note" : "Profile updated successfully",
        "username" : doctor.name,
        "email" : doctor.email,
        "hospital_id" : doctor.hospital_id,
        "specialty" : doctor.specialty,
        "google_email_id" : doctor.google_email_id
    }

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
async def cancel_appointment(doctor : doctor_dependency, db : db_dependency, appointment_id : Optional[int] = None, date : Optional[datetime] = None, background_tasks : BackgroundTasks = BackgroundTasks()):
    base_query = db.query(Appointments).filter(Appointments.doctor_id == doctor.id)
    
    # if appointment_id is provided then cancel that appointment only if it belongs to the doctor
    if appointment_id is not None:
        base_query = base_query.filter(Appointments.id == appointment_id)
    # if date is provided then cancel all appointments of the doctor on that date
    elif date is not None:
        only_date = date.date()
        base_query = base_query.filter(func.date(Appointments.date) == only_date)
    
    appointments = base_query.all()
    # if no appointments is found then throw error
    if not appointments:
        raise HTTPException(status_code = 404, detail = "Appointment not found")
    try:
        # if the appointments are already cancelled then throw error
        for app in appointments:
            if app.status == "CANCELLED":
                raise HTTPException(status_code = 400, detail = "Appointment already cancelled")
    
        for app in appointments:
            background_tasks.add_task(
                create_notification,
                message = f"Appointment {app.id} of user {app.user_id} has been cancelled by doctor {doctor.name}", 
                recipient_id = app.user_id, 
                recipient_role = "user"
            )
            db.delete(app)
    except Exception as e:
        # rollback the transaction
        db.rollback()
        raise HTTPException(status_code = 400, detail = e)
    
    db.commit()
    return {
        "note" : "Appointments cancelled successfully",
        "deleted" : True,
        "deleted_count" : len(appointments)
    }

@router.delete("/cases/document", status_code = 200)
async def remove_document_from_case(
    doctor : doctor_dependency, 
    db : db_dependency, 
    case_id : int = Query(..., gt = 0), 
    document_id : int = Query(..., gt = 0),
    background_tasks : BackgroundTasks = BackgroundTasks()
):
    case = db.query(Cases).filter(Cases.id == case_id, Cases.doctor_id == doctor.id, case.status == "OPEN").first()
    if not case:
        raise HTTPException(404, "Case not found")
    
    if case.doctor_doc_ids and document_id in case.doctor_doc_ids:
        case.doctor_doc_ids = [id for id in case.doctor_doc_ids if id != document_id]
        case.last_updated = datetime.now()
        db.commit()
        background_tasks.add_task(
            create_notification,
            message = f"doctor {doctor.name} has removed document {document_id} from the case {case.case_id}", 
            recipient_id = case.user_id, 
            recipient_role = "user"
        )
    
    return {
        "note" : f"Document {document_id} removed from case"
    }