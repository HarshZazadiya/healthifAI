from typing import Annotated
from logs.logging import logger
from database import SessionLocal
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException
from routers.auth import create_access_token
from models import Users, Doctors, Hospitals

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]

async def handle_google_login(actual_email, actual_user_id, actual_role, user_email, user_name, user_pic, access_token, refresh_token, db : db_dependency):
    user = db.query(Users).filter(Users.email == actual_email).first()
    if not user:
        # Determine role: check if doctor or hospital
        doctor = db.query(Doctors).filter(Doctors.email == actual_email).first()
        hospital = db.query(Hospitals).filter(Hospitals.email == actual_email).first()
        if doctor:
            role = "doctor"
            entity_type = "doctor"
            entity_id = doctor.id
            # Update tokens and profile info for doctor
            doctor.google_email_id = user_email
            doctor.google_access_token = access_token
            doctor.google_refresh_token = refresh_token
            doctor.google_profile_pic = user_pic
            doctor.google_name = user_name
            db.commit()
            logger.info(f"Updated Google tokens for existing doctor {doctor.name} with email {user_email}")
        elif hospital:
            role = "hospital"
            entity_type = "hospital"
            entity_id = hospital.id
            # Update tokens and profile info for hospital
            hospital.google_access_token = access_token
            hospital.google_refresh_token = refresh_token
            hospital.google_profile_pic = user_pic
            hospital.google_name = user_name
            hospital.google_email_id = user_email
            db.commit()
            logger.info(f"Updated Google tokens for existing hospital {hospital.name} with email {user_email}")
        else:
            raise HTTPException(status_code = 404, detail = "No user, doctor, or hospital found with this email. Please register first using the email : " + user_email)
    else:
        role = user.role
        entity_type = "user"
        entity_id = user.id
        # Update tokens and profile info
        user.google_access_token = access_token
        user.google_refresh_token = refresh_token
        user.google_profile_pic = user_pic
        user.google_name = user_name
        user.google_email_id = user_email
        db.commit()
        logger.info(f"Updated Google tokens for existing user {user.name} with email {user_email}")
    
    # Create JWT
    jwt_token = create_access_token(entity_id, entity_type, role)
    return jwt_token

async def check_duplicacy(actual_email, role, db : db_dependency):   
    if role == "user" or role == "admin":
        user = db.query(Users).filter(Users.email == actual_email).first()
        if user:
            return True
    elif role == "doctor":
        user = db.query(Doctors).filter(Doctors.email == actual_email).first()
        if user:
            return True
    elif role == "hospital":
        user = db.query(Hospitals).filter(Hospitals.email == actual_email).first()
        if user:
            return True