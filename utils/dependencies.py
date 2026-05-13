import os
from typing import Annotated
from jose import jwt, JWTError
from database import SessionLocal
from sqlalchemy.orm import Session
from utils.helper import oauth2_bearer
from fastapi import Depends, HTTPException
from models import Users, Doctors, Hospitals
from utils.get_current_requester import get_current_requester_by_token

# =====================================================================================
# CONFIG
# =====================================================================================

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

# =====================================================================================
# DEPENDECY INJECTION FUNCTIONS
# =====================================================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]

async def get_current_user(token : Annotated[str, Depends(oauth2_bearer)], db : db_dependency):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms = [ALGORITHM])
        if payload.get("type") != "user":
            raise HTTPException(status_code = 403, detail = "User access only")

        user = db.query(Users).filter(Users.id == payload.get("id")).first()
        if not user:
            raise HTTPException(status_code = 401, detail = "Invalid token")

        return user

    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid token")

async def get_current_admin(token : Annotated[str, Depends(oauth2_bearer)], db : db_dependency):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms = [ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code = 403, detail = "Admin access only")

        admin = db.query(Users).filter(Users.id == payload.get("id")).first()
        if not admin:
            raise HTTPException(status_code = 401, detail = "Invalid token")

        return admin

    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid token")

async def get_current_doctor(token : Annotated[str, Depends(oauth2_bearer)], db : db_dependency):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms = [ALGORITHM])
        if payload.get("type") != "doctor":
            raise HTTPException(status_code = 403, detail = "Doctor access only")

        doctor = db.query(Doctors).filter(Doctors.id == payload.get("id")).first()
        if not doctor:
            raise HTTPException(status_code = 401, detail = "Invalid token")

        return doctor

    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid token")

async def get_current_hospital(token : Annotated[str, Depends(oauth2_bearer)], db : db_dependency):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms = [ALGORITHM])
        if payload.get("type") != "hospital":
            raise HTTPException(status_code = 403, detail = "Hospital access only")

        hospital = db.query(Hospitals).filter(Hospitals.id == payload.get("id")).first()
        if not hospital:
            raise HTTPException(status_code = 401, detail = "Invalid token")

        return hospital

    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid token")
    
user_dependency = Annotated[Users, Depends(get_current_user)]
admin_dependency = Annotated[Users, Depends(get_current_admin)]
doctor_dependency = Annotated[Doctors, Depends(get_current_doctor)]
hospital_dependency = Annotated[Hospitals, Depends(get_current_hospital)]
requester_dependency = Annotated[dict, Depends(get_current_requester_by_token)]