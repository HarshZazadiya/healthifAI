import os
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from urllib.parse import urljoin
from fastapi import APIRouter, HTTPException, Query
from services.notifcation import create_notification
from utils.signed_url_generator import generate_signed_url
from utils.dependencies import admin_dependency, db_dependency
from models import Cases, Users, Doctors, Wallet, Hospitals, Documents, Symptoms, UserPayments, DoctorPayments

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
async def see_profile(admin : admin_dependency, db : db_dependency):
    return {
        "name" : admin.name, 
        "email" : admin.email,
        "phone_number" : admin.phone_number,
        "role" : admin.role,
        "google_email_id" : admin.google_email_id,
        "account_type" : admin.account_type,
        "lat" : admin.lat,
        "lon" : admin.lon
    }

@router.get("/users", status_code = 200)
async def get_all_users(
    admin : admin_dependency, 
    db : db_dependency, 
    name : Optional[str] = None, 
    email : Optional[str] = None, 
    account_type : Optional[str] = None, 
    is_active : Optional[str] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    users = db.query(Users).filter(Users.role != "admin")
    if name :
        users = users.filter(Users.name == name.title())
    if email :
        users = users.filter(Users.email == email)
    if account_type :
        users = users.filter(Users.account_type == account_type)
    if is_active is not None :
        users = users.filter(Users.is_active == is_active)
    
    users = users.offset((page - 1) * limit).limit(limit).all()
    if not users :
        raise HTTPException(status_code = 404, detail = "No Users found")
    return [
        {
            "id" : user.id,
            "username" : user.name,
            "email" : user.email,
            "phone_number" : user.phone_number,
            "google_email_id" : user.google_email_id,
            "account_type" : user.account_type,
            "role" : user.role,
            "lat" : user.lat,
            "lon" : user.lon,
            "is_active" : user.is_active
        }
        for user in users
    ]

@router.get("/doctors", status_code = 200)
async def get_all_doctors(
    admin: admin_dependency, 
    db: db_dependency,
    name: Optional[str] = None,
    email: Optional[str] = None,
    specialty: Optional[str] = None,
    rating: Optional[float] = None,
    availability: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge = 1),
    limit: int = Query(20, ge = 1, le = 100)
):
    try:
        # Start with base queries
        hospital_query = db.query(Hospitals)
        doctor_query = db.query(Doctors)
        
        # Apply filters to doctors
        if name:
            doctor_query = doctor_query.filter(Doctors.name.ilike(f"%{name}%"))
        
        if email:
            doctor_query = doctor_query.filter(Doctors.email.ilike(f"%{email}%"))
        
        if specialty:
            doctor_query = doctor_query.filter(Doctors.specialty.ilike(f"%{specialty}%"))
        
        if rating is not None:
            doctor_query = doctor_query.filter(Doctors.rating >= rating)
        
        if availability is not None:
            doctor_query = doctor_query.filter(Doctors.availability == availability)
        
        if is_active is not None:
            doctor_query = doctor_query.filter(Doctors.is_active == is_active)
        
        # Get all matching doctors
        doctors = doctor_query.all()
        
        if not doctors:
            raise HTTPException(status_code = 404, detail = "No Doctors found")
        
        # Get unique hospital IDs from filtered doctors
        hospital_ids = list(set(d.hospital_id for d in doctors))
        
        # Get hospitals
        hospitals = hospital_query.filter(Hospitals.id.in_(hospital_ids)).all()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code = 500, detail = str(e))
    
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
        
        data.append({
            "hospital_id": hospital.id,
            "hospital_name": hospital.name,
            "hospital_email": hospital.email,
            "hospital_address": f"{hospital.address}, {hospital.city}, {hospital.state}, {hospital.zip}",
            "hospital_phone_number": hospital.phone_number,
            "hospital_lat": float(hospital.lat) if hospital.lat else None,
            "hospital_lon": float(hospital.lon) if hospital.lon else None,
            "hospital_rating": float(hospital.rating) if hospital.rating else 0,
            "total_doctors": len(hospital_doctors),
            "doctors": [{
                "id": doctor.id,
                "name": doctor.name,
                "email": doctor.email,
                "phone_number": doctor.phone_number,
                "specialty": doctor.specialty,
                "fees": doctor.fees,
                "appointment_fees": doctor.appointment_fees,
                "rating": float(doctor.rating) if doctor.rating else 0,
                "availability": doctor.availability,
                "is_active": doctor.is_active,
                "google_email_id": doctor.google_email_id if doctor.google_email_id else "Google account is not connected"
            } for doctor in hospital_doctors]
        })
    
    # Apply pagination on hospitals
    total_hospitals = len(data)
    paginated_data = data[(page - 1) * limit : page * limit]
    
    return {
        "data": paginated_data,
        "page": page,
        "limit": limit,
        "total_hospitals": total_hospitals,
        "total_pages": (total_hospitals + limit - 1) // limit
    }

@router.get("/hospitals", status_code = 200)
async def get_all_hospitals(
    admin : admin_dependency, 
    db : db_dependency,
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
    hospitals = db.query(Hospitals)
    if name :
        hospitals = hospitals.filter(Hospitals.name == name.title())
    if email :
        hospitals = hospitals.filter(Hospitals.email == email)
    if city :
        hospitals = hospitals.filter(Hospitals.city == city.title())
    if state :
        hospitals = hospitals.filter(Hospitals.state == state.title())
    if zip :
        hospitals = hospitals.filter(Hospitals.zip == zip)
    if rating :
        hospitals = hospitals.filter(Hospitals.rating == rating)
    if cases :
        hospitals = hospitals.filter(Hospitals.cases >= cases)

    hospitals = hospitals.offset((page - 1) * limit).limit(limit).all()
    if not hospitals :
        raise HTTPException(status_code = 404, detail = "No Hospitals found")
    return [
        {
            "id" : hospital.id,
            "name" : hospital.name,
            "email" : hospital.email,
            "phone_number" : hospital.phone_number,
            "google_email_id" : hospital.google_email_id,
            "address" : hospital.address,
            "city" : hospital.city,
            "state" : hospital.state,
            "zip" : hospital.zip,
            "lat" : hospital.lat,
            "lon" : hospital.lon,
            "rating" : hospital.rating,
            "cases" : hospital.cases
        }
        for hospital in hospitals
    ]

@router.get("/cases", status_code = 200)
async def get_all_cases(
    admin : admin_dependency,
    db : db_dependency,
    date : Optional[datetime] = None,
    doctor_name : Optional[str] = None,
    user_name : Optional[str] = None,
    cost : Optional[float] = None,
    diesease : Optional[str] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    # Build base query with joins (avoid N+1 queries later)
    cases_query = db.query(Cases).join(Users, Cases.user_id == Users.id).join(Doctors, Cases.doctor_id == Doctors.id)
    
    # Apply filters
    if date:
        start_of_day = datetime.combine(date, datetime.min.time())
        end_of_day = datetime.combine(date, datetime.max.time())
        cases_query = cases_query.filter(Cases.date >= start_of_day, Cases.date <= end_of_day)
    
    if doctor_name:
        cases_query = cases_query.filter(Doctors.name.ilike(f"%{doctor_name}%"))
    
    if user_name:
        cases_query = cases_query.filter(Users.name.ilike(f"%{user_name}%"))
    
    if cost is not None:
        cases_query = cases_query.filter(Cases.cost == cost)
    
    if diesease:
        cases_query = cases_query.filter(Cases.diesease.ilike(f"%{diesease}%"))
    
    # Get total count (single query)
    total_cases = cases_query.count()
    
    # Get paginated cases with eager loading of relationships
    cases = cases_query.order_by(Cases.date.desc()).offset((page - 1) * limit).limit(limit).all()
    
    if not cases:
        raise HTTPException(status_code=404, detail="No Cases found")
    
    # Collect all IDs in single pass
    user_ids = set()
    doctor_ids = set()
    hospital_ids = set()
    all_symptom_ids = set()
    all_user_doc_ids = set()
    all_doctor_doc_ids = set()
    
    for case in cases:
        user_ids.add(case.user_id)
        doctor_ids.add(case.doctor_id)
        hospital_ids.add(case.hospital_id)
        
        if case.symptom_ids:
            all_symptom_ids.update(case.symptom_ids)
        if case.user_doc_ids:
            all_user_doc_ids.update(case.user_doc_ids)
        if case.doctor_doc_ids:
            all_doctor_doc_ids.update(case.doctor_doc_ids)
    
    all_document_ids = all_user_doc_ids | all_doctor_doc_ids
    
    # Batch fetch all related data in parallel (using asyncio.gather for async operations)
    import asyncio
    
    # These are sync DB queries, but we can run them efficiently
    users_future = db.query(Users).filter(Users.id.in_(user_ids))
    doctors_future = db.query(Doctors).filter(Doctors.id.in_(doctor_ids))
    hospitals_future = db.query(Hospitals).filter(Hospitals.id.in_(hospital_ids))
    symptoms_future = db.query(Symptoms).filter(Symptoms.id.in_(all_symptom_ids)) if all_symptom_ids else None
    documents_future = db.query(Documents).filter(Documents.id.in_(all_document_ids)) if all_document_ids else None
    
    # Execute queries
    users_list = users_future.all()
    doctors_list = doctors_future.all()
    hospitals_list = hospitals_future.all()
    symptoms_list = symptoms_future.all() if symptoms_future else []
    documents_list = documents_future.all() if documents_future else []
    
    # Create lookup maps (single pass)
    users_map = {u.id: u for u in users_list}
    doctors_map = {d.id: d for d in doctors_list}
    symptoms_map = {s.id: s for s in symptoms_list}
    
    hospitals_map = {
        h.id: {
            "id" : h.id,
            "name" : h.name,
            "email" : h.email,
            "phone_number" : h.phone_number,
            "google_email_id" : h.google_email_id,
            "address" : h.address,
            "city" : h.city,
            "state" : h.state,
            "zip" : h.zip,
            "lat" : float(h.lat) if h.lat else None,
            "lon" : float(h.lon) if h.lon else None,
            "rating" : float(h.rating) if h.rating else 0,
            "total_cases" : h.cases
        } for h in hospitals_list
    }
    
    # Generate signed URLs for documents (batch if possible)
    documents_map = {}
    if documents_list:
        url_tasks = []
        doc_ids = []
        
        for dt in documents_list:
            url_tasks.append(generate_signed_url(dt.document_path, admin.id, "admin", dt.id, 5000))
            doc_ids.append(dt.id)
        
        # Get all signed URLs concurrently
        raw_urls = await asyncio.gather(*url_tasks)
        
        # Build documents map with complete URLs
        for doc_id, dt, raw_url in zip(doc_ids, documents_list, raw_urls):
            full_url = urljoin(BASE_URL, raw_url) if BASE_URL else raw_url
            documents_map[dt.id] = {
                "id" : dt.id,
                "type" : dt.type,
                "url" : full_url
            }
    
    # Build response efficiently
    data = []
    for case in cases:
        user = users_map.get(case.user_id)
        doctor = doctors_map.get(case.doctor_id)
        
        if not user or not doctor:
            continue
        
        # Build symptoms list
        case_symptoms = []
        if case.symptom_ids:
            for sid in case.symptom_ids:
                symptom = symptoms_map.get(sid)
                if symptom:
                    case_symptoms.append({
                        "id" : symptom.id,
                        "symptom" : symptom.symptom,
                        "severity" : symptom.severity
                    })
        
        # Build document lists
        case_doctor_docs = [documents_map[did] for did in (case.doctor_doc_ids or []) if did in documents_map]
        case_user_docs = [documents_map[uid] for uid in (case.user_doc_ids or []) if uid in documents_map]
        
        data.append({
            "id" : case.id,
            "case_id" : case.case_id,
            "date" : case.date.isoformat() if case.date else None,
            "last_updated" : case.last_updated.isoformat() if case.last_updated else None,
            "status" : case.status,
            "diesease" : case.diesease,
            "cost" : float(case.cost) if case.cost else 0,
            "user" : {
                "id" : user.id,
                "name" : user.name,
                "email" : user.email,
                "phone_number" : user.phone_number
            },
            "doctor" : {
                "id" : doctor.id,
                "name" : doctor.name,
                "email" : doctor.email,
                "specialty" : doctor.specialty
            },
            "hospital" : hospitals_map.get(case.hospital_id),
            "symptoms" : case_symptoms,
            "doctor_documents" : case_doctor_docs,
            "user_documents" : case_user_docs
        })
    
    return {
        "data" : data,
        "page" : page,
        "limit" : limit,
        "total_cases" : total_cases,
        "total_pages" : (total_cases + limit - 1) // limit
    }

@router.get("/transactions/", status_code = 200)
async def get_all_transactions(
    admin : admin_dependency, 
    db : db_dependency, 
    usertype : Optional[str] = Query("all", description="user, doctor, or all"),
    date : Optional[datetime] = None,
    amount : Optional[float] = None,
    page : int = Query(1, ge = 1), 
    limit : int = Query(20, ge = 1, le = 100)
):
    usertype = usertype.lower().strip() if usertype else "all"
    
    if usertype not in ["user", "doctor", "all"]:
        raise HTTPException(status_code=400, detail="usertype must be 'user', 'doctor', or 'all'")
    
    result = {}
    
    # Fetch user transactions
    if usertype in ["user", "all"]:
        user_query = db.query(UserPayments)
        
        if date:
            start_of_day = datetime.combine(date, datetime.min.time())
            end_of_day = datetime.combine(date, datetime.max.time())
            user_query = user_query.filter(UserPayments.date >= start_of_day, UserPayments.date <= end_of_day)
        
        if amount is not None:
            user_query = user_query.filter(UserPayments.amount == amount)
        
        total_user = user_query.count()
        user_transactions = user_query.order_by(UserPayments.date.desc()).offset((page - 1) * limit).limit(limit).all()
        
        result["user_transactions"] = [
            {
                "id": t.id,
                "user_id": t.user_id,
                "amount": float(t.amount) if t.amount else 0,
                "date": t.date.isoformat() if t.date else None,
                "type": t.type,
                "note": t.note
            }
            for t in user_transactions
        ]
        result["user_total"] = total_user
    
    # Fetch doctor transactions
    if usertype in ["doctor", "all"]:
        doctor_query = db.query(DoctorPayments)
        
        if date:
            start_of_day = datetime.combine(date, datetime.min.time())
            end_of_day = datetime.combine(date, datetime.max.time())
            doctor_query = doctor_query.filter(DoctorPayments.date >= start_of_day, DoctorPayments.date <= end_of_day)
        
        if amount is not None:
            doctor_query = doctor_query.filter(DoctorPayments.amount == amount)
        
        total_doctor = doctor_query.count()
        doctor_transactions = doctor_query.order_by(DoctorPayments.date.desc()).offset((page - 1) * limit).limit(limit).all()
        
        result["doctor_transactions"] = [
            {
                "id": t.id,
                "doctor_id": t.doctor_id,
                "amount": float(t.amount) if t.amount else 0,
                "date": t.date.isoformat() if t.date else None,
                "type": t.type,
                "note": t.note
            }
            for t in doctor_transactions
        ]
        result["doctor_total"] = total_doctor
    
    # Check if any data found
    if not result.get("user_transactions") and not result.get("doctor_transactions"):
        raise HTTPException(status_code=404, detail="No transactions found")
    
    return {
        "data": result,
        "page": page,
        "limit": limit,
        "usertype": usertype
    }

@router.get("/wallets/", status_code = 200)
async def get_all_wallets(
    admin : admin_dependency, 
    db : db_dependency, 
    role : Optional[str] = None,
    amount : Optional[int] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100)
):
    wallets = db.query(Wallet)
    if role :
        wallets = wallets.filter(Wallet.role == role)
    if amount :
        wallets = wallets.filter(Wallet.balance == amount)

    wallets = wallets.offset((page - 1) * limit).limit(limit).all()
    if not wallets :
        raise HTTPException(status_code = 404, detail = "No wallets found")

    return [
        {
            "id" : wallet.id,
            "user_id" : wallet.user_id,
            "role" : wallet.role,
            "balance" : wallet.balance
        }
        for wallet in wallets
    ]

# =====================================================================================
# POST REQUESTS
# =====================================================================================

@router.post("/notification/", status_code = 200)
async def send_notification(admin : admin_dependency,  db : db_dependency,  notification : NotificationRequest):
    try :
        await create_notification(
            db, 
            notification.message, 
            notification.recipient_id, 
            notification.recipient_role
        )
    except Exception as e:
        raise HTTPException(status_code = 500, detail = f"Error creating notification: {e}")
    
    return {
        "note" : f"Notification sent successfully to {notification.recipient_id} with role {notification.recipient_role}"
    }

# =====================================================================================
# PUT REQUESTS
# =====================================================================================

@router.put("/profile", status_code = 200)
async def update_profile(admin : admin_dependency, request : ProfileRequest, db : db_dependency):
    admin.name = request.name if request.name else admin.name
    admin.email = request.email if request.email else admin.email
    admin.phone_number = request.phone_number if request.phone_number else admin.phone_number

    db.commit()
    db.refresh(admin)

    return {
        "note" : "Profile updated successfully",
        "username" : admin.name,
        "email" : admin.email
    }

@router.put("/reactive/user/{user_id}", status_code = 200)
async def reactive_user(admin : admin_dependency, user_id : int, db : db_dependency):
    user = db.query(Users).filter(Users.id == user_id).first()
    if not user:
        raise HTTPException(status_code = 404, detail = "User not found")
    if user.is_active == True:
        raise HTTPException(status_code = 400, detail = "User is already active")
    user.is_active = True
    db.commit()
    return {"note" : "User reactivated successfully"}

@router.put("/reactive/doctor/{doctor_id}", status_code = 200)
async def reactive_doctor(admin : admin_dependency, doctor_id : int, db : db_dependency):
    doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code = 404, detail = "Doctor not found")
    if doctor.is_active == True:
        raise HTTPException(status_code = 400, detail = "Doctor is already active")
    doctor.is_active = True
    db.commit()
    return {"note" : "Doctor reactivated successfully"}

@router.put("/reactive/hospital/{hospital_id}", status_code = 200)
async def reactive_hospital(admin : admin_dependency, hospital_id : int, db : db_dependency):
    hospital = db.query(Hospitals).filter(Hospitals.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code = 404, detail = "Hospital not found")
    if hospital.is_active == True:
        raise HTTPException(status_code = 400, detail = "Hospital is already active")
    hospital.is_active = True
    db.commit()
    return {"note" : "Hospital reactivated successfully"}

# =====================================================================================
# DELETE REQUESTS
# =====================================================================================

@router.delete("/users/{user_id}", status_code = 200)
async def delete_user(admin : admin_dependency, user_id : int, db : db_dependency):
    user = db.query(Users).filter(Users.id == user_id).first()
    if not user:
        raise HTTPException(status_code = 404, detail = "User not found")
    user.is_active = False
    db.commit()
    return {"note" : "User deleted successfully"}

@router.delete("/doctors/{doctor_id}", status_code = 200)
async def delete_doctor(admin : admin_dependency, doctor_id : int, db : db_dependency):
    doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code = 404, detail = "Doctor not found")
    doctor.is_active = False
    db.commit()
    return {"note" : "Doctor deleted successfully"}

@router.delete("/hospital/{hospital_id}", status_code = 200)
async def delete_hospital(admin : admin_dependency, hospital_id : int, db : db_dependency):
    hospital = db.query(Hospitals).filter(Hospitals.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code = 404, detail = "hospital not found")
    hospital.is_active = False
    # all doctors of the hospital will be deleted
    doctors = db.query(Doctors).filter(Doctors.hospital_id == hospital_id).all()
    for doctor in doctors:
        doctor.is_active = False
    db.commit()
    return {"note" : "hospital deleted successfully"}

