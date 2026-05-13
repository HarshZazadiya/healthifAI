import os
from typing import Annotated
from pydantic import BaseModel
from jose import jwt, JWTError
from database import SessionLocal
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from models import Users, Doctors, Wallet, Hospitals
from fastapi.security import OAuth2PasswordRequestForm
from utils.helper import bcrypt_context, oauth2_bearer
from fastapi import BackgroundTasks
from utils.hospital_location_getter import hospital_location_getter 

router = APIRouter(
    prefix = "/auth",
    tags = ["Auth"]
)

# =====================================================================================
# PYDANTIC MODELS
# =====================================================================================

class Token(BaseModel):
    access_token : str
    token_type : str

class Login(BaseModel):
    username : str
    password : str

class CreateUserRequest(BaseModel):
    username : str
    email : str
    password : str
    phone : str

class CreateHospitalRequest(BaseModel):
    name : str
    email : str
    password : str
    address : str
    city : str
    state : str
    zip : str
    phone : str

# =====================================================================================
# CONFIG
# =====================================================================================

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

# =====================================================================================
# DEPENDENCIES
# =====================================================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]

# =====================================================================================
# HELPER FUNCTIONS
# =====================================================================================

def authenticate_user(email : str, password : str, db : Session):
    user = db.query(Users).filter(Users.email == email).first()
    if not user:
        return None
    if not bcrypt_context.verify(password, user.hashed_password):
        return None
    return user

def authenticate_doctor(email : str, password : str, db : Session):
    doctor = db.query(Doctors).filter(Doctors.email == email).first()
    if not doctor:
        return None
    if not bcrypt_context.verify(password, doctor.hashed_password):
        return None
    return doctor

def authenticate_hospital(email : str, password : str, db : Session):
    hospital = db.query(Hospitals).filter(Hospitals.email == email).first()
    if not hospital:
        return None
    if not bcrypt_context.verify(password, hospital.hashed_password):
        return None
    return hospital

# =====================================================================================
# TOKEN CREATION
# =====================================================================================

def create_access_token(entity_id : int, entity_type : str, role : str):
    payload = {
        "id" : entity_id,
        "type" : entity_type,
        "role" : role,
        "exp" : datetime.now(timezone.utc) + timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm = ALGORITHM)

def create_refresh_token(entity_id : int, entity_type : str, role : str):
    payload = {
        "id" : entity_id,
        "type" : entity_type,
        "role" : role,
        "exp" : datetime.now(timezone.utc)+ timedelta(days = 7),
        "token_type" : "refresh",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm = ALGORITHM)

# =====================================================================================
# TOKEN REQUEST ENDPOINT
# =====================================================================================

@router.post("/token")
async def login(form_data : OAuth2PasswordRequestForm = Depends(), db : Session = Depends(get_db)):
    user = authenticate_user(form_data.username, form_data.password, db)
    if user:
        return {
            "access_token" : create_access_token(user.id, "user", user.role),
            "refresh_token" : create_refresh_token(user.id, "user", user.role),
            "token_type" : "bearer",
            "type" : "user",
            "id" : user.id,
            "role" : user.role,
            "name" : user.name,
            "email" : user.email,
            "google_profile_pic" : user.google_profile_pic,
            "google_name" : user.google_name
        }

    doctor = authenticate_doctor(form_data.username, form_data.password, db)
    if doctor:
        return {
            "access_token" : create_access_token(doctor.id, "doctor", "doctor"),
            "refresh_token" : create_refresh_token(doctor.id, "doctor", "doctor"),
            "token_type" : "bearer",
            "type" : "doctor",
            "id" : doctor.id,
            "role" : "doctor",
            "name" : doctor.name,
            "email" : doctor.email,
            "google_profile_pic" : doctor.google_profile_pic,
            "google_name" : doctor.google_name
        }
    
    hospital = authenticate_hospital(form_data.username, form_data.password, db)
    if hospital:
        return {
            "access_token" : create_access_token(hospital.id, "hospital", "hospital"),
            "refresh_token" : create_refresh_token(hospital.id, "hospital", "hospital"),
            "token_type" : "bearer",
            "type" : "hospital",
            "id" : hospital.id,
            "role" : "hospital",
            "name" : hospital.name,
            "email" : hospital.email,
            "google_profile_pic" : hospital.google_profile_pic,
            "google_name" : hospital.google_name
        }
    
    raise HTTPException(status_code = 401, detail = "Invalid credentials")


@router.post("/refresh")
async def refresh(token : str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms = [ALGORITHM])
        if not payload.get("id") or not payload.get("type") or not payload.get("role"):
            raise HTTPException(status_code = 401, detail = "Invalid token")
        if payload.get("token_type") != "refresh":
            raise HTTPException(status_code = 403, detail = "Refresh token required")
        
        expiry_time = datetime.fromtimestamp(payload.get("exp"), tz=timezone.utc)
        if datetime.now(timezone.utc) > expiry_time:
            raise HTTPException(status_code = 401, detail = "Token expired")
        
        return {
            "access_token" : create_access_token(payload.get("id"), payload.get("type"), payload.get("role")),
            "token_type" : "bearer",
        }
    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid token")

# =====================================================================================
# CREATE USERS | DOCTORS | HOSTPITALS | ADMIN
# =====================================================================================

@router.post("/user", status_code = 201)
async def create_user(request : CreateUserRequest, db : db_dependency):
    user = Users(
        name = request.username.title(),
        email = request.email,
        hashed_password = bcrypt_context.hash(request.password),
        phone_number = request.phone
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    wallet = Wallet(
        user_id = user.id, 
        role = "user", 
        balance = 0
    )
    db.add(wallet)
    db.commit()
    
    return {"id" : user.id, "username" : user.name}

@router.post("/hospital", status_code = 201)
async def register_hospital(request : CreateHospitalRequest, db : db_dependency, background_tasks : BackgroundTasks = BackgroundTasks()):
    hospital = Hospitals(
        name = request.name.title(),
        email = request.email,
        hashed_password = bcrypt_context.hash(request.password),
        address = request.address,
        city = request.city.title(),
        state = request.state.title(),
        zip = request.zip,
        phone_number = request.phone
    )
    db.add(hospital)
    db.commit()

    wallet = Wallet(
        user_id = hospital.id, 
        role = "hospital", 
        balance = 0
    )
    db.add(wallet)
    db.commit()
    db.refresh(hospital)

    # in baackground get hospital location
    background_tasks.add_task(
        hospital_location_getter,
        db,
        hospital.id
    )

    return {"id" : hospital.id, "name" : hospital.name}

# =====================================================================================
# DECODE TOKEN
# =====================================================================================

@router.get("/me")
async def get_me(token : Annotated[str, Depends(oauth2_bearer)]):
    payload = jwt.decode(token, SECRET_KEY, algorithms = [ALGORITHM])
    return {"id" : payload["id"], "type" : payload["type"], "role" : payload["role"]}  