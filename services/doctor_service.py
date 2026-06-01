import asyncio
from typing import Optional
from datetime import datetime
from database import SessionLocal
from fastapi import HTTPException
from services.payment import handle_payment
from services.notification import create_notification
from models import AssignedDoctors, Cases, Hospitals, Doctors, Users, Wallet

async def get_all_doctors(page : int, limit : int, doctor_name : Optional[str] = None,  hospital_name : Optional[str] = None,):
    db = SessionLocal()
    try  :
        # Start with base queries
        hospital_query = db.query(Hospitals)
        
        # Filter by hospital name if provided
        if hospital_name:
            hospital = hospital_query.filter(Hospitals.name.ilike(hospital_name), Hospitals.is_active == True).first()
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
        doctor_query = db.query(Doctors).filter(Doctors.hospital_id.in_(hospital_ids), Doctors.is_active == True)
        
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
                    "speciality" : doctor.speciality,
                    "google_email_id" : doctor.google_email_id if doctor.google_email_id else "Google account is not connected",
                    "fees" : doctor.fees,
                    "appointment_fees" : doctor.appointment_fees
                } for doctor in hospital_doctors]
            })
        
        return data
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

async def get_my_doctors(user_id : int, page : int, limit : int, doctor_name : Optional[str] = None,  hospital_name : Optional[str] = None):
    db = SessionLocal()
    try :
        query = db.query(AssignedDoctors).filter(AssignedDoctors.user_id == user_id)
        
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
            for c in db.query(Cases).filter(Cases.user_id == user_id, Cases.doctor_id.in_(doctor_ids), Cases.status == "OPEN").all()
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
                "speciality" : doctor.speciality,
                "hospital" : hospital.name if hospital else None,
                "hospital_id" : doctor.hospital_id,
                "hospital_lat" : hospital.lat if hospital else None,
                "hospital_lon" : hospital.lon if hospital else None
            })
        
        return data
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

async def assign_doctor_to_user(doctor_id : int, user_id : int, user_role : str, user_name : str):
    db = SessionLocal()
    try:
        is_assigned = db.query(AssignedDoctors).filter(AssignedDoctors.user_id == user_id, AssignedDoctors.doctor_id == doctor_id).first()
        is_case = db.query(Cases).filter(Cases.doctor_id == doctor_id, Cases.user_id == user_id, Cases.status == "OPEN").first()
        if is_assigned:
            raise HTTPException(status_code = 400, detail = "You are already assigned to this doctor")
        if is_case:
            raise HTTPException(status_code = 400, detail = "You already have an open case with this doctor")
        # assign a doctor
        assigned = AssignedDoctors(
            user_id = user_id, 
            doctor_id = doctor_id,
            date = datetime.now()
        )
        db.add(assigned)

        doctor = db.query(Doctors).filter(Doctors.id == doctor_id, Doctors.is_active == True).first()
        if not doctor:
            raise HTTPException(status_code = 404, detail = "Doctor not found")
        if doctor.availability == False:
            raise HTTPException(status_code = 400, detail = "Doctor is not available")
        result = await handle_payment(db, user_id, user_role, doctor_id, "doctor", doctor.fees, note = f"Fees of doctor {doctor.name}")
        
        # add a case
        hospital = db.query(Hospitals).filter(Hospitals.id == doctor.hospital_id).first()
        if not hospital:
            raise HTTPException(status_code = 404, detail = "Hospital not found")
        case = Cases(
            case_id = hospital.cases + 1,
            user_id = user_id, 
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
        asyncio.create_task(
            create_notification(
            message = f"You have been assigned to case {case.case_id} for user {user_name}", 
            recipient_id = case.doctor_id, 
            recipient_role = "doctor")
        )

        asyncio.create_task(
            create_notification(
            message = f"You have been sucessfully assigned to doctor {doctor.name}", 
            recipient_id = user_id, 
            recipient_role = "user")
        )

        return {
            "note" : "Doctor assigned successfully",
            "assigned_doctor_id" : assigned.doctor_id,
            "doctor_name" : doctor.name,
            "case" : case.id,
            "case_id" : case.case_id,
            "fees" : doctor.fees,
            "transaction_id" : result["transaction_id"] if result else None,
            "user_id" : user_id
        }
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

async def get_doctors_under_same_hospital(doctor_id : int):
    db = SessionLocal()
    try :
        doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
        if not doctor:
            raise HTTPException(status_code = 404, detail = "Doctor not found")
        doctors = db.query(Doctors).filter(Doctors.hospital_id == doctor.hospital_id).all()
        if not doctors:
            raise HTTPException(status_code = 404, detail = "No doctors found")
        data = []
        for doc in doctors :
            data.append({
                "id" : doc.id,
                "name" : doc.name,
                "registered_email" : doc.google_email_id if doc.google_email_id else doc.email,
                "phone_number" : doc.phone_number,
                "speciality" : doc.speciality,
                "rating" : doc.rating,
                "total_cases" : doc.current_cases,
                "fees" : doc.fees,
                "appointment_fees" : doc.appointment_fees
            })
        return data
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

async def get_hospital_details(doctor : Doctors):
    db = SessionLocal()
    try :
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
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

async def get_assigned_users_of_doctor(doctor_id : int, page, limit, user_name : Optional[str] = None):
    db = SessionLocal()
    try :
        # see a specific user's info
        query = db.query(AssignedDoctors).filter(AssignedDoctors.doctor_id == doctor_id)
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

        cases = db.query(Cases).filter(Cases.user_id.in_(assigned_user_ids), Cases.doctor_id == doctor_id, Cases.status != "CLOSED").all()
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
                "phone_number" : user.phone_number,
                "user_google_email_id" : user.google_email_id,
                "user_lat" : user.lat,
                "user_lon" : user.lon,
                "case_id" : case.case_id if case else None,
                "case_db_id" : case.id if case else None,
                "case_opened_at" : case.date.isoformat() if case else None,
                "last_updated" : case.last_updated.isoformat() if case else None
            })

        return data
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

async def get_all_doctors_for_hospital(
    hospital_id : int, 
    page : int, 
    limit : int, 
    rating : Optional[int] = None,
    email : Optional[str] = None,
    speciality : Optional[str] = None,
    name : Optional[str] = None,
    availability : Optional[bool] = None
):
    db = SessionLocal()
    try :
        doctors = db.query(Doctors).filter(Doctors.hospital_id == hospital_id)
        if availability :
            doctors = doctors.filter(Doctors.availability == availability)
        if rating :
            doctors = doctors.filter(Doctors.rating == rating)
        if email :
            doctors = doctors.filter(Doctors.email == email)
        if speciality :
            doctors = doctors.filter(Doctors.speciality == speciality.title())
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
                "speciality" : doc.speciality,
                "case_limit" : doc.limit,
                "availability" : doc.availability,
                "phone_number" : doc.phone_number,
                "current_cases" : doc.current_cases,
                "google_email_id" : doc.google_email_id
            })
        return data
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

async def get_doctors_balance_for_hospital(
    hospital_id : int,
    page : int, 
    limit : int,
    doctor_name : Optional[str] = None
):
    db = SessionLocal()
    try :
        doctors = db.query(Doctors).filter(Doctors.hospital_id == hospital_id)
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
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

async def get_doctor_fees_for_hospital(hospital_id : int):
    db = SessionLocal()
    try :
        doctors = db.query(Doctors).filter(Doctors.hospital_id == hospital_id).all()
        data = []
        for doctor in doctors:
            data.append({
                "id" : doctor.id,
                "name" : doctor.name,
                "fees" : doctor.fees,
                "appointment_fees" : doctor.appointment_fees
            })
        return data
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

