import asyncio

from models import AssignedDoctors, Doctors
from fastapi import HTTPException
from database import SessionLocal
from services.notification import create_notification

async def check_or_set_availability(doctor_id : int):
    db = SessionLocal()
    try :
        doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
        if doctor.current_cases >= doctor.limit :
            doctor.availability = False
            db.commit()
            return False
        return True
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

async def set_limit_for_doctor(doctor_id : int, hospital_name : str, limit : int):
    db = SessionLocal()
    try :
        doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
        doctor.limit = limit
        db.commit()
        asyncio.create_task(
            create_notification(
                message = f"Your case limit has been changed to {limit} by hospital {hospital_name}",
                recipient_id = doctor_id,
                recipient_role = "doctor"
            )
        )
        return {
            "note" : f"Limit {doctor.limit} set successfully for doctor {doctor.name}"
        }
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

async def set_availibility_for_doctor(doctor_id : int, hospital_name : str, availability : bool):
    db = SessionLocal()
    try : 
        doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
        doctor.availability = availability
        db.commit()
        users = db.query(AssignedDoctors).filter(AssignedDoctors.doctor_id == doctor_id).all()
        doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
        for user in users:
            asyncio.create_task(
                create_notification(
                    message = f"Your doctor {doctor.name} availibility has been changed to {availability} by hospital {hospital_name}",
                    recipient_id = user.user_id,
                    recipient_role = "user"
                )
            )
        asyncio.create_task(
            create_notification(
                message = f"Your availibility has been changed to {availability} by hospital {hospital_name}",
                recipient_id = doctor_id,
                recipient_role = "doctor"
            )
        )
        return {
            "note" : f"Availability {doctor.availability} set successfully for doctor {doctor.name}"
        }
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

