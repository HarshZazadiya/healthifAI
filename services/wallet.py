from typing import Optional
from models import DoctorPayments, Doctors, Hospitals
from database import SessionLocal
from fastapi import HTTPException
from datetime import date, datetime
from models import UserPayments, Wallet
from services.payment import handle_payment

async def my_wallet(owner_id : int, owner_role : str):
    """Get current wallet balance"""
    db = SessionLocal()
    try :
        if owner_role == "hospital":
            hospital = db.query(Hospitals).filter(Hospitals.id == owner_id).first()
            if not hospital:
                raise HTTPException(status_code = 404, detail = "Hospital not found")
            if hospital.merged_wallet_id:
                wallet = db.query(Wallet).filter(Wallet.id == hospital.merged_wallet_id).first()
                if not wallet:
                    raise HTTPException(status_code = 404, detail = "Wallet not found")
            else:
                wallet = db.query(Wallet).filter(Wallet.role == owner_role, Wallet.user_id == owner_id).first()
                if not wallet:
                    raise HTTPException(status_code = 404, detail = "Wallet not found")
        else:
            wallet = db.query(Wallet).filter(Wallet.role == owner_role, Wallet.user_id == owner_id).first()
            if not wallet:
                raise HTTPException(status_code = 404, detail = "Wallet not found")

        response = {"balance" : float(wallet.balance)}

        return response
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

async def top_up(amount: int, owner_id: int, owner_role : str, owner_type : str):
    db = SessionLocal()
    try :
        if owner_role == "hospital":
            hospital = db.query(Hospitals).filter(Hospitals.id == owner_id).first()
            if not hospital:
                raise HTTPException(status_code = 404, detail = "Hospital not found")
            if hospital.merged_wallet_id:
                wallet = db.query(Wallet).filter(Wallet.id == hospital.merged_wallet_id).first()
                if not wallet:
                    raise HTTPException(status_code = 404, detail = "Wallet not found")
            else:
                wallet = db.query(Wallet).filter(Wallet.role == owner_role, Wallet.user_id == owner_id).first()
                if not wallet:
                    raise HTTPException(status_code = 404, detail = "Wallet not found")
        else:
            wallet = db.query(Wallet).filter(Wallet.role == owner_role, Wallet.user_id == owner_id).first()
            if not wallet:
                raise HTTPException(status_code = 404, detail = "Wallet not found")

        # First, process the payment
        result = None
        if owner_role not in ["hospital", "admin"]:
            result = await handle_payment(
                db, 
                owner_id, 
                owner_role, 
                owner_id, 
                owner_role, 
                amount, 
                note = "Topping up wallet", 
                type = "TOP-UP"
            )
            if not result:
                raise HTTPException(status_code = 400, detail = "Payment failed")

        # Then update wallet balance
        wallet.balance += amount
        db.commit()
        db.refresh(wallet)

        return {
            "id": owner_id,
            "role": owner_type,
            "balance": wallet.balance,
            "payment_added": result if result else "No payment added to transactions",
            "message": "Wallet topped up successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

async def show_user_transactions(
    user_id : int, 
    page : int,
    limit : int,
    type : Optional[str] = None,
    date : Optional[date] = None,
):
    db = SessionLocal()
    try :
        query = db.query(UserPayments).filter(UserPayments.user_id == user_id,  UserPayments.role == "user")

        if type:
            query = query.filter(UserPayments.type == type.upper())

        if date:
            start_of_day = datetime.combine(date, datetime.min.time())
            end_of_day = datetime.combine(date, datetime.max.time())
            query = query.filter(UserPayments.date >= start_of_day,  UserPayments.date <= end_of_day)

        transactions = query.order_by(UserPayments.date.desc()).offset((page - 1) * limit).limit(limit).all()
        
        return [
            {
                "id" : transaction.id,
                "date" : transaction.date.isoformat() if transaction.date else None,
                "amount" : transaction.amount,
                "type" : transaction.type,
                "note" : transaction.note
            }
            for transaction in transactions
        ]
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

async def change_note(transaction_id : int, note : str, requester_id : int, requester_role : str):
    db = SessionLocal()
    try :
        if requester_role == "user" :
            transaction = db.query(UserPayments).filter(UserPayments.id == transaction_id, UserPayments.user_id == requester_id).first()
            if not transaction:
                raise HTTPException(status_code = 404, detail = "Transaction not found")

            transaction.note = note
            db.commit()
            db.refresh(transaction)

            return {
                "note" : "Transaction note updated successfully",
                "id" : transaction.id,
                "note" : transaction.note
            }
        elif requester_role == "doctor" :
            transaction = db.query(DoctorPayments).filter(DoctorPayments.id == transaction_id, DoctorPayments.doctor_id == requester_id).first()
            if not transaction:
                raise HTTPException(status_code = 404, detail = "Transaction not found")

            transaction.note = note
            db.commit()
            db.refresh(transaction)

            return {
                "note" : "Transaction note updated successfully",
                "id" : transaction.id,
                "note" : transaction.note
            }
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

async def show_doctor_transactions(doctor_id : int, type : Optional[str] = None, date : Optional[date] = None, page : int = 1, limit : int = 10):
    db = SessionLocal()
    try :
        query = db.query(DoctorPayments).filter(DoctorPayments.doctor_id == doctor_id)

        # filter by type and date if provided
        if type:
            query = query.filter(DoctorPayments.type == type.upper())
        if date:
            start_of_day = datetime.combine(date, datetime.min.time())
            end_of_day = datetime.combine(date, datetime.max.time())
            query = query.filter(DoctorPayments.date >= start_of_day, DoctorPayments.date <= end_of_day)

        transactions = query.order_by(DoctorPayments.date.desc()).offset((page - 1) * limit).limit(limit).all()
        return [
            {
                "id" : transaction.id,
                "date" : transaction.date.isoformat(),
                "amount" : transaction.amount,
                "type" : transaction.type,
                "note" : transaction.note
            }
            for transaction in transactions
        ]
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()

async def show_doctor_transactions_for_hospital(
    hospital_id : int,
    page : int, 
    limit : int,
    type : Optional[str] = None, 
    date : Optional[datetime] = None,
    doctor_name : Optional[str] = None
):
    db = SessionLocal()
    try :
        doctors = db.query(Doctors).filter(Doctors.hospital_id == hospital_id)
        if doctor_name:
            doctors = doctors.filter(Doctors.name == doctor_name.title())
        doctors = doctors.offset((page - 1) * limit).limit(limit).all()
        if not doctors:
            raise HTTPException(404, "No doctors found")
        doctor_map = {d.id : d.name for d in doctors}
        query = db.query(DoctorPayments).filter(DoctorPayments.doctor_id.in_([doc.id for doc in doctors]))

        if type:
            query = query.filter(DoctorPayments.type == type)
        if date:
            query = query.filter(DoctorPayments.date == date)

        transactions = query.order_by(DoctorPayments.date.desc()).offset((page - 1) * limit).limit(limit).all()
        data = []
        for transaction in transactions:
            doctor = doctor_map.get(transaction.doctor_id)
            if doctor:
                data.append({
                    "id" : transaction.id,
                    "date" : transaction.date.isoformat(),
                    "amount" : transaction.amount,
                    "type" : transaction.type,
                    "note" : transaction.note,
                    "doctor" : doctor
                })
        return data
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))
    finally :
        db.close()
    
