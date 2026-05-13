from models import Doctors
from sqlalchemy.orm import Session

async def check_or_set_availability(db : Session, doctor_id : int):
    doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
    if doctor.current_cases >= doctor.limit :
        doctor.availability = False
        db.commit()
        return False
    return True

async def set_limit_for_doctor(db : Session, doctor_id : int, limit : int):
    doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
    doctor.limit = limit
    db.commit()
    return {
        "note" : f"Limit {doctor.limit} set successfully for doctor {doctor.name}"
    }

async def set_availibility_for_doctor(db : Session, doctor_id : int, availability : bool):
    doctor = db.query(Doctors).filter(Doctors.id == doctor_id).first()
    doctor.availability = availability
    db.commit()
    return {
        "note" : f"Availability {doctor.availability} set successfully for doctor {doctor.name}"
    }