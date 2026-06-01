import os
from fastapi import Depends, HTTPException
from jose import JWTError, jwt
from database import SessionLocal
from models import Users, Doctors, Hospitals
from typing import Annotated, Optional
from utils.helper import oauth2_bearer
from sqlalchemy.orm import Session  

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]

async def get_current_requester_by_token(token : Annotated[str, Depends(oauth2_bearer)]):
    db = SessionLocal()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms = [ALGORITHM])
        id = payload.get("id")
        role = payload.get("role")
        if payload.get("type") == "user":
            requester = db.query(Users).filter(Users.id == id, Users.role == role).first()
            name = requester.name
            if not requester:
                raise HTTPException(status_code = 401, detail = "Invalid token")
        elif payload.get("type") == "doctor":
            requester = db.query(Doctors).filter(Doctors.id == id).first()
            name = requester.name
            if not requester:
                raise HTTPException(status_code = 401, detail = "Invalid token")
        elif payload.get("type") == "hospital":
            requester = db.query(Hospitals).filter(Hospitals.id == id).first()
            name = requester.name
            if not requester:
                raise HTTPException(status_code = 401, detail = "Invalid token")

        return {
            "id" : id,
            "name" : name,
            "type" : payload.get("type"),
            "role" : role
        }

    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid token")
    finally:
        db.close()
    
async def get_current_requester_by_id_and_role(id : int , role : str):
    db = SessionLocal()
    try :
        if role == "user" or role == "admin":
            requester = db.query(Users).filter(Users.id == id, Users.role == role).first()
            if not requester:
                raise HTTPException(status_code = 401, detail = "Invalid token")
        elif role == "doctor":
            requester = db.query(Doctors).filter(Doctors.id == id).first()
            if not requester:
                raise HTTPException(status_code = 401, detail = "Invalid token")
        elif role == "hospital":
            requester = db.query(Hospitals).filter(Hospitals.id == id).first()
            if not requester:
                raise HTTPException(status_code = 401, detail = "Invalid token")

        return requester
    except Exception as e:
        raise HTTPException(status_code = 401, detail = "Invalid token")
    finally:
        db.close()