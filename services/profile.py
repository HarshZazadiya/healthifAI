import asyncio
from typing import Optional
from database import SessionLocal
from fastapi import HTTPException
from utils.helper import bcrypt_context
from services.notification import create_notification
from models import AssignedDoctors, Users, Doctors, Hospitals
from utils.hospital_location_getter import hospital_location_getter

async def user_profile(user_id : int, role : str):
    db = SessionLocal() 
    try:
        if role == "user" or role == "admin":
            user = db.query(Users).filter(Users.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code = 404, detail = "User not found")

        return {
            "name" : user.name,
            "email" : user.email,
            "google_email_id" : user.google_email_id if user.google_email_id else "Google account is not connected"
        }
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

async def doctor_profile(doctor_id : int):
    db = SessionLocal() 
    try:
        doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
        
        if not doctor:
            raise HTTPException(status_code = 404, detail = "Doctor not found")

        return {
            "name" : doctor.name,
            "email" : doctor.email,
            "google_email_id" : doctor.google_email_id,
            "availability" : doctor.availability,
            "speciality" : doctor.speciality
        }
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

async def hospital_profile(hospital_id : int):
    db = SessionLocal() 
    try:
        hospital = db.query(Hospitals).filter(Hospitals.id == hospital_id).first()
        
        if not hospital:
            raise HTTPException(status_code = 404, detail = "Hospital not found")

        return {
            "name" : hospital.name,
            "email" : hospital.email,
            "address" : hospital.address,
            "city" : hospital.city,
            "state" : hospital.state,
            "charges" : hospital.charges,
            "total_cases" : hospital.cases,
            "zip" : hospital.zip,
            "phone_number" : hospital.phone_number,
            "google_email_id" : hospital.google_email_id
        }
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

async def change_password(new_password : str, requester_id : int, requester_role : str):
    db = SessionLocal()
    try : 
        
        if requester_role == "user" or requester_role == "admin":
            person = db.query(Users).filter(Users.id == requester_id).first()
        elif requester_role == "doctor":
            person = db.query(Doctors).filter(Doctors.id == requester_id).first()
        elif requester_role == "hospital":
            person = db.query(Hospitals).filter(Hospitals.id == requester_id).first()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown role: {requester_role}")

        if not person:
            raise HTTPException(status_code=404, detail="User not found")

        person.hashed_password = bcrypt_context.hash(new_password)
        db.commit()
        db.refresh(person)

        return {
            "id": person.id, 
            "username": person.name, 
            "role": requester_role
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        db.close()

async def update_user_profile(user_id : int, username : Optional[str] = None, email : Optional[str] = None):
    db = SessionLocal()
    try :
        user = db.query(Users).filter(Users.id == user_id).first()
        if not user:
            raise HTTPException(status_code = 404, detail = "User not found")
        if username : 
            user.name = username
        if email :
            user.email = email
        if not username and not email:
            raise HTTPException(status_code = 400, detail = "No fields to update")
        db.commit()
        db.refresh(user)

        return {
            "note": "Profile updated successfully",
            "username": user.name,
            "email": user.email
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        db.close()

async def update_doctor_profile(username : str, email : str, speciality : str, availability : str, doctor_id : int):
    db = SessionLocal()
    try :
        doctor = db .query(Doctors).filter(Doctors.id == doctor_id).first()
        if not doctor:
            raise HTTPException(status_code = 404, detail = "Doctor not found")
        # if data is provided then update them otherwise keep the older one
        doctor.name = username if username else doctor.name
        doctor.email = email if email else doctor.email
        doctor.speciality = speciality if speciality else doctor.speciality
        doctor.availability = availability if availability else doctor.availability
        

        db.commit()
        db.refresh(doctor)

        # send notification to user assigned to doctor
        users = db.query(AssignedDoctors).filter(AssignedDoctors.doctor_id == doctor.id).all()
        for user in users:
            asyncio.create_task(
                create_notification(
                message = f"Your profile has been updated by doctor {doctor.name}", 
                recipient_id = user.user_id, 
                recipient_role = "user")
            )

        return {
            "note" : "Profile updated successfully",
            "username" : doctor.name,
            "email" : doctor.email,
            "hospital_id" : doctor.hospital_id,
            "speciality" : doctor.speciality,
            "google_email_id" : doctor.google_email_id
        }
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

async def update_hospital_profile(username : str, email : str, address : str, city : str, state : str, zip : str, phone_number : str, hospital_id : int):
    db = SessionLocal()
    try :
        hospital = db.query(Hospitals).filter(Hospitals.id == hospital_id).first()
        hospital.name = username.title() if username else hospital.name
        hospital.email = email if email else hospital.email
        hospital.address = address.title() if address else hospital.address
        hospital.city = city.title() if city else hospital.city
        hospital.state = state.title() if state else hospital.state
        hospital.zip = zip if zip else hospital.zip,
        hospital.phone_number = phone_number if phone_number else hospital.phone_number

        db.commit()
        db.refresh(hospital)

        # if address related field was changes then change lat and lon in background task
        if address or city or state or zip:
            asyncio.create_task(
                hospital_location_getter,
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
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

async def see_admin_profile(admin_id : int):
    db = SessionLocal()
    try : 
        admin = db.query(Users).filter(Users.id == admin_id, Users.role == "admin").first()
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
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

async def update_admin_profile(admin_id : int, name : str, email : str, phone_number : str):
    db = SessionLocal()
    try : 
        admin = db.query(Users).filter(Users.id == admin_id, Users.role == "admin").first()
        admin.name = name if name else admin.name
        admin.email = email if email else admin.email
        admin.phone_number = phone_number if phone_number else admin.phone_number

        db.commit()
        db.refresh(admin)

        return {
            "note" : "Profile updated successfully",
            "username" : admin.name,
            "email" : admin.email
        }
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

