import os
import requests
import urllib.parse
from typing import Annotated
from pydantic import BaseModel
from jose import jwt, JWTError
from logs.logging import logger
from sqlalchemy.orm import Session
from requests.compat import urljoin
from fastapi import BackgroundTasks, Request
from utils.dependencies import db_dependency
from fastapi.responses import RedirectResponse
from datetime import timedelta, datetime, timezone
from models import Users, Doctors, Wallet, Hospitals
from fastapi import APIRouter, Depends, HTTPException
from utils.helper import oauth2_bearer, bcrypt_context
from fastapi.security import OAuth2PasswordRequestForm
from utils.google_credential_handler import handle_google_login
from utils.hospital_location_getter import hospital_location_getter
from utils.get_current_requester import get_current_requester_by_id_and_role
from utils.jwt_utils import create_access_token, create_refresh_token

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

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

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

# =====================================================================================
# TOKEN REQUEST ENDPOINT
# =====================================================================================

@router.post("/token")
async def login(db : db_dependency, form_data : OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password, db)
    if user and user.is_active == False:
        raise HTTPException(status_code = 401, detail = "You have been inactivated by the admin")
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
    if doctor and doctor.is_active == False:
        raise HTTPException(status_code = 401, detail = "You have been inactivated by the admin")
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
    if hospital and hospital.is_active == False:
        raise HTTPException(status_code = 401, detail = "You have been inactivated by the admin")
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
    name = request.name
    list_elements = name.split(" ")
    if list_elements[-1].lower() != "hospital":
        list_elements.append("Hospital")
        name = " ".join(list_elements)

    hospital = Hospitals(
        name = name.title(),
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

# =====================================================================================
# Google OAuth
# =====================================================================================

@router.get("/google")
async def google_auth(request: Request, token: str = None):
    # Try getting token from query parameters first, then check Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise HTTPException(status_code = 401, detail = "Authentication required")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms = [ALGORITHM])
        user_id = payload.get("id")
        user_role = payload.get("role")
        if not user_id or not user_role:
            raise HTTPException(status_code = 401, detail = "Invalid token details")
    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid token")

    state = f"{user_id}_{user_role}"
    
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.send",
        "access_type": "offline",
        "prompt": "consent",
        "state": state
    }

    oauth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return RedirectResponse(oauth_url)

async def get_google_user(access_token):
    url = "https://www.googleapis.com/oauth2/v2/userinfo"
    headers = {"Authorization" : f"Bearer {access_token}"}
    res = requests.get(url, headers = headers)
    return res.json()

@router.get("/callback")
async def google_callback(request: Request, db : db_dependency):
    code = request.query_params.get("code")
    state = request.query_params.get("state")

    if not code:
        return {"error" : "No code provided"}
    
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code" : code,
        "client_id" : CLIENT_ID,
        "client_secret" : CLIENT_SECRET,
        "redirect_uri" : REDIRECT_URI,
        "grant_type" : "authorization_code"
    }
    response = requests.post(token_url, data=data)
    google_tokens = response.json()
    
    # get user info from state
    if not state:
        return {"error" : "No state provided"}
    
    user_id, role = state.split("_")
    actual_user_id = int(user_id)
    actual_role = role.lower()
    
    requester = await get_current_requester_by_id_and_role(actual_user_id, actual_role)

    if "refresh_token" not in google_tokens:
        return {"error" : "Failed to get refresh token", "details" : google_tokens}
    if "access_token" not in google_tokens:
        return {"error" : "Failed to get access token", "details" : google_tokens}
    
    user_info = await get_google_user(google_tokens["access_token"])
    
    user_google_email = user_info.get("email")
    user_google_name = user_info.get("name")
    user_google_pic = user_info.get("picture")
    
    if not user_google_email:
        return {"error": "Failed to get user email"}
    
    # get jwt token by user info
    from fastapi.responses import RedirectResponse

    try:
        jwt_token = await handle_google_login(requester.email, actual_user_id, actual_role, user_google_email, user_google_name, user_google_pic, google_tokens.get("access_token"), google_tokens.get("refresh_token"), db)
        react_base_url = os.getenv("REACT_BASE_URL")
        react_url = urljoin(react_base_url, os.getenv("FRONTEND_URL"))
        
        # Create redirect response
        response = RedirectResponse(url = react_url, status_code = 302)
        
        # Set HTTP-only cookie
        response.set_cookie(
            key = "auth_token",
            value = jwt_token,
            httponly = True,
            secure = False,  # Set to True in production with HTTPS
            samesite = "lax",
            max_age = 86400,  # 24 hours
            path = "/"
        )
        
        return response
        
    except HTTPException as e:
        return {"error" : e.detail}
    finally:
        db.close()