from decimal import Decimal
from typing import Optional
from logs.logging import logger
from fastapi import HTTPException
from sqlalchemy.orm import Session
from utils.redis_config import redis_client
from models import Doctors, Hospitals, Users, Wallet, UserPayments, DoctorPayments

async def handle_payment(
    db : Session,
    sender_id : int, 
    sender_role : str, 
    reciever_id : int, 
    reciever_role : str, 
    amount : float, 
    note : Optional[str] = None,
    type : Optional[str] = None,
):
    if sender_role.lower() not in ["user", "doctor", "hospital", "admin"] or reciever_role.lower() not in ["user", "doctor", "hospital", "admin"]:
        raise HTTPException(status_code = 400, detail = "Invalid role")
    if sender_role == reciever_role and sender_id == reciever_id and note != "TOP-UP":
        raise HTTPException(status_code = 400, detail = "Sender and reciever cannot be same")
    if amount < 0:
        raise HTTPException(status_code = 400, detail = "Amount can not be less than 0")
    # top up wallet
    if note == "TOP-UP" and (sender_role == reciever_role and sender_id == reciever_id):
        if sender_role == "user":
            payment = UserPayments(
                user_id = sender_id,
                amount = amount,
                role = sender_role,
                type = type,
                note = note
            )
        elif sender_role == "doctor":
            payment = DoctorPayments(
                doctor_id = sender_id,
                amount = amount,
                type = type,
                note = note
            )
        else :
            raise HTTPException(status_code = 400, detail = "Invalid role")
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return {
            "id" : payment.id,
            "user_id" : payment.user_id,
            "amount" : payment.amount,
            "type" : payment.type,
            "note" : payment.note,
            "message" : "Wallet topped up successfully"
        }

    sender_wallet = db.query(Wallet).filter(Wallet.user_id == sender_id, Wallet.role == sender_role).first()
    middleman = None
    middleman_commision = 0
    if reciever_role == "doctor" :
        hospital = db.query(Hospitals).filter(Hospitals.id == reciever_id).first()
        if not hospital:
            raise HTTPException(status_code = 404, detail = "Hospital not found")
        
        if hospital.merged_wallet_id is None:
            hospital_wallet = db.query(Wallet).filter(Wallet.user_id == hospital.id, Wallet.role == "hospital").first()
        else :
            hospital_wallet = db.query(Wallet).filter(Wallet.id == hospital.merged_wallet_id).first()
        middleman = hospital_wallet
        middleman_commision = hospital.charges
    reciever_wallet = db.query(Wallet).filter(Wallet.user_id == reciever_id, Wallet.role == reciever_role).first()
    
    if not sender_wallet or not reciever_wallet:
        raise HTTPException(status_code = 404, detail = "Sender or reciever not found")

    if sender_wallet.balance < amount:
        raise HTTPException(status_code = 400, detail = "Insufficient balance")
    # Convert amount to Decimal to match wallet balance type
    amount_decimal = Decimal(str(amount))
    
    try: 
        sender_wallet.balance -= amount_decimal
        admin_wallet = db.query(Wallet).filter(Wallet.role == "admin").first()  
        if not admin_wallet:
            raise HTTPException(status_code = 404, detail = "Admin wallet not found")
        
        reciever_share = 1 - 0.2 - float(middleman_commision)
        if reciever_role == "admin":
            reciever_share = 1
        if reciever_share < 0:
            raise HTTPException(status_code = 400, detail = "Reciever share can not be less than 0")
        if reciever_share > 1:
            raise HTTPException(status_code = 400, detail = "Reciever share can not be greater than 1")
        if reciever_share < 0.4 :
            raise HTTPException(status_code = 400, detail = "Reciever share can not be less than 0.4")
        
        if reciever_role != "admin":
            reciever_wallet.balance += amount_decimal * Decimal(reciever_share)          # 80% to reciever
            if middleman is not None:
                middleman.balance += amount_decimal * Decimal(middleman_commision)       # middleman_commision% to middleman
            admin_wallet.balance += amount_decimal * Decimal('0.2')             # 20% to admin
        else:
            admin_wallet.balance += amount_decimal                              # 100% to admin
            
    except Exception as e:
        raise HTTPException(status_code = 500, detail = f"Payment failed : {e}")

    if sender_role == "user":
        user = db.query(Users).filter(Users.id == sender_id, Users.role == "user").first()
        sender_payment = UserPayments(
            user_id = sender_id, 
            role = sender_role, 
            amount = amount,
            type = type if type else "OUTGOING",
            note = note if note else None
        )
        if reciever_role == "doctor" : 
            word = "Appointment Fees" if "Appointment" in note else "Fees"
            reciever_payment = DoctorPayments(
                doctor_id = reciever_id, 
                amount = amount,
                type = type if type else "INCOMING",
                note = f"{word} from user {user.name}"
            )
            db.add(reciever_payment)
            logger.info(f"payment recieved : {reciever_payment}")
    elif sender_role == "doctor":
        sender_payment = DoctorPayments(
            doctor_id = sender_id, 
            amount = amount,
            type = type if type else "OUTGOING",
            note = note if note else None
        )
        if reciever_role == "user":
            reciever_payment = UserPayments(
                user_id = reciever_id, 
                role = reciever_role, 
                amount = amount,
                type = type if type else "INCOMING",
                note = note if note else None
            )
            db.add(reciever_payment)
            logger.info(f"payment recieved : {reciever_payment}")
    else:
        raise HTTPException(status_code = 400, detail = "Invalid role")

    if sender_payment :
        db.add(sender_payment)
        db.commit()
        logger.info(f"payment sent : {sender_payment}")

    # clear cache
    if redis_client:
        try:
            await redis_client.delete(f"wallet : {reciever_role} : {reciever_id}")
            await redis_client.delete(f"wallet : {sender_role} : {sender_id}")
            logger.info(f"✅ Redis cache cleared for {reciever_role} : {reciever_id}")
            logger.info(f"✅ Redis cache cleared for {sender_role} : {sender_id}")
        except Exception as e:
            logger.info(f"⚠️ Redis cache clear failed (non-critical) : {e}")

    return {
        "status" : "success",
        "transaction_id" : sender_payment.id if sender_payment else None
    }

async def handle_refund(db : Session, reciver_id : int, reciver_role : str, sender_id : int, sender_role : str, amount : float, note : str = None):
    reciever_wallet = db.query(Wallet).filter(Wallet.user_id == reciver_id, Wallet.role == reciver_role).first()
    sender_wallet = db.query(Wallet).filter(Wallet.user_id == sender_id, Wallet.role == sender_role).first()
    amount_decimal = Decimal(str(amount)) * Decimal(1 - 0.2)
    if not reciever_wallet or not sender_wallet:
        raise HTTPException(status_code = 404, detail = "Reciever or sender not found")
    if sender_wallet.balance < amount_decimal:
        raise HTTPException(status_code = 400, detail = "Insufficient balance")
    doctor = db.query(Doctors).filter(Doctors.id == sender_id).first()
    hospital = db.query(Hospitals).filter(Hospitals.id == doctor.hospital_id).first()
    if not hospital:
        raise HTTPException(status_code = 404, detail = "Hospital not found")
    hospital_wallet = db.query(Wallet).filter(Wallet.user_id == hospital.id, Wallet.role == "hospital").first()
    if not hospital_wallet:
        raise HTTPException(status_code = 404, detail = "Hospital wallet not found")
    
    hospital_wallet.balance -= amount_decimal * hospital.charges
    # Convert amount to Decimal to match wallet balance type
    amount_decimal = Decimal(str(amount)) * Decimal(1 - 0.2)
    reciever_wallet.balance += amount_decimal 
    sender_wallet.balance -= amount_decimal 
    
    reciever_payment = UserPayments(
        user_id = reciver_id, 
        role = reciver_role, 
        amount = amount_decimal,
        type = "INCOMING",
        note = note if note else None
    )

    sender_payment = DoctorPayments(
        doctor_id = sender_id, 
        amount = amount_decimal,
        type = "OUTGOING",
        note = note if note else None
    )

    db.add(sender_payment)
    db.add(reciever_payment)
    db.commit()
    logger.info(f"payment recieved : {reciever_payment.amount}")
    logger.info(f"payment sent : {sender_payment.amount}")
    return {
        "status" : "success",
        "transaction_id" : reciever_payment.id
    }