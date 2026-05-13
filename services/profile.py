from fastapi import HTTPException
from utils.helper import bcrypt_context
from models import Users, Doctors, Hospitals

async def change_password(request, requester, db):
    role = requester.get("role")
    
    if role == "user" or role == "admin":
        person = db.query(Users).filter(Users.id == requester.get("id")).first()
    elif role == "doctor" or role == "host":
        person = db.query(Doctors).filter(Doctors.id == requester.get("id")).first()
    elif role == "hospital":
        person = db.query(Hospitals).filter(Hospitals.id == requester.get("id")).first()
    else:
        raise HTTPException(status_code=400, detail=f"Unknown role: {role}")

    if not person:
        raise HTTPException(status_code=404, detail="User not found")

    person.hashed_password = bcrypt_context.hash(request.password)
    db.commit()
    db.refresh(person)

    return {
        "id": person.id, 
        "username": requester.get("name"), 
        "role": requester.get("role")
    }