from sqlalchemy.orm import Session
from utils.helper import bcrypt_context
from routers.auth import create_access_token
from models import Users, Doctors, Wallet, Hospitals

async def authenticate_user(email: str, name: str, db: Session):
    # Check if user exists in Users table
    user = db.query(Users).filter(Users.email == email).first()
    if user:
        role = user.role
        type = "user"
    else:
        # Check if user exists in Doctors table
        user = db.query(Doctors).filter(Doctors.email == email).first()
        if user:
            role = "doctor"
            type = "doctor"
        else:
            # Check if user exists in Hospitals table
            user = db.query(Hospitals).filter(Hospitals.email == email).first()
            if user:
                role = "hospital"
                type = "hospital"
            else:
                # User doesn't exist, create as regular user
                new_user = Users(
                    name = name,
                    email = email,
                    hashed_password = bcrypt_context.hash("test"),  # Dummy password
                    role = "user"
                )
                db.add(new_user)
                db.commit()
                db.refresh(new_user)

                # Create wallet for new user
                new_wallet = Wallet(
                    user_id = new_user.id,
                    role = "user",
                    balance = 0
                )
                db.add(new_wallet)
                db.commit()

                user = new_user
                role = "user"
                type = "user"

    access_token = create_access_token(user.id, type, role)
    return access_token