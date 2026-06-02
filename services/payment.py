import os
import hmac
import hashlib
import razorpay
from decimal import Decimal
from typing import Optional
from logs.logging import logger
from fastapi import HTTPException
from database import SessionLocal
from utils.redis_config import redis_client
from models import Doctors, Hospitals, Users, Wallet, UserPayments, DoctorPayments

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_TEST_API_KEY")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_TEST_KEY_SECRET")
CURRENCY = os.getenv("CURRENCY")

client = razorpay.Client(auth = (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

def verify_razorpay_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
    """
    Verify Razorpay payment signature for security.
    Returns True if signature is valid, False otherwise.
    """
    try:
        message = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return expected_signature == razorpay_signature
    except Exception as e:
        logger.error(f"Signature verification error: {e}")
        return False

def verify_webhook_signature(webhook_body: str, webhook_signature: str) -> bool:
    """
    Verify Razorpay webhook signature.
    Returns True if signature is valid, False otherwise.
    """
    try:
        expected_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            webhook_body.encode(),
            hashlib.sha256
        ).hexdigest()
        return expected_signature == webhook_signature
    except Exception as e:
        logger.error(f"Webhook signature verification error: {e}")
        return False

async def get_payment_status(payment_id: str) -> dict:
    """
    Get payment status from Razorpay.
    Returns payment details if successful.
    """
    try:
        payment = client.payment.fetch(payment_id)
        return {
            "id": payment.get("id"),
            "amount": payment.get("amount"),
            "status": payment.get("status"),
            "order_id": payment.get("order_id"),
            "captured": payment.get("captured"),
            "notes": payment.get("notes")
        }
    except Exception as e:
        logger.error(f"Error fetching payment status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch payment status: {e}")

async def verify_payment(order_id: str, payment_id: str, signature: str) -> dict:
    """
    Verify payment after Razorpay redirects user back.
    Updates wallet only after successful verification.
    """
    db = SessionLocal()
    try:
        # Verify signature
        if not verify_razorpay_signature(order_id, payment_id, signature):
            logger.warning(f"Invalid signature for order {order_id}")
            raise HTTPException(status_code=400, detail="Invalid payment signature")
        
        # Get payment status from Razorpay
        payment_status = await get_payment_status(payment_id)
        
        if payment_status["status"] != "captured":
            logger.warning(f"Payment not captured for order {order_id}")
            raise HTTPException(status_code=400, detail="Payment not captured")
        
        # Find the payment record
        user_payment = db.query(UserPayments).filter(UserPayments.razorpay_order_id == order_id).first()
        doctor_payment = db.query(DoctorPayments).filter(DoctorPayments.razorpay_order_id == order_id).first()
        
        payment_record = user_payment or doctor_payment
        
        if not payment_record:
            logger.warning(f"No payment record found for order {order_id}")
            raise HTTPException(status_code=404, detail="Payment record not found")
        
        # Update payment record with Razorpay IDs
        payment_record.razorpay_payment_id = payment_id
        payment_record.razorpay_signature = signature
        payment_record.payment_status = "completed"
        
        # Update wallet balance
        if isinstance(payment_record, UserPayments):
            wallet = db.query(Wallet).filter(
                Wallet.user_id == payment_record.user_id,
                Wallet.role == "user"
            ).first()
        else:
            wallet = db.query(Wallet).filter(
                Wallet.user_id == payment_record.doctor_id,
                Wallet.role == "doctor"
            ).first()
        
        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")
        
        # Add amount to wallet
        wallet.balance += Decimal(str(payment_record.amount))
        db.commit()
        
        logger.info(f"Payment verified and wallet updated for order {order_id}")
        
        # Clear Redis cache
        if redis_client:
            try:
                if isinstance(payment_record, UserPayments):
                    await redis_client.delete(f"wallet : user : {payment_record.user_id}")
                else:
                    await redis_client.delete(f"wallet : doctor : {payment_record.doctor_id}")
            except Exception as e:
                logger.info(f"Redis cache clear failed (non-critical): {e}")
        
        return {
            "status": "success",
            "message": "Payment verified successfully",
            "order_id": order_id,
            "payment_id": payment_id
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Payment verification failed: {e}")
        raise
    finally:
        db.close()

async def handle_webhook(event_data: dict) -> dict:
    """
    Handle Razorpay webhook events.
    Supports payment.authorized and payment.failed events.
    """
    db = SessionLocal()
    try:
        event = event_data.get("event")
        payload = event_data.get("payload", {})
        payment = payload.get("payment", {})
        order = payload.get("order", {})
        
        payment_id = payment.get("entity", {}).get("id")
        order_id = order.get("entity", {}).get("id")
        
        logger.info(f"Processing webhook event: {event} for order: {order_id}")
        
        if event == "payment.authorized":
            # Payment was authorized and captured
            user_payment = db.query(UserPayments).filter(UserPayments.razorpay_order_id == order_id).first()
            doctor_payment = db.query(DoctorPayments).filter(DoctorPayments.razorpay_order_id == order_id).first()
            
            payment_record = user_payment or doctor_payment
            
            if payment_record:
                payment_record.razorpay_payment_id = payment_id
                payment_record.payment_status = "completed"
                
                # Update wallet
                if isinstance(payment_record, UserPayments):
                    wallet = db.query(Wallet).filter(
                        Wallet.user_id == payment_record.user_id,
                        Wallet.role == "user"
                    ).first()
                else:
                    wallet = db.query(Wallet).filter(
                        Wallet.user_id == payment_record.doctor_id,
                        Wallet.role == "doctor"
                    ).first()
                
                if wallet:
                    wallet.balance += Decimal(str(payment_record.amount))
                
                db.commit()
                logger.info(f"Webhook: Payment authorized and wallet updated for order {order_id}")
            
            return {"status": "success", "message": "Payment processed successfully"}
        
        elif event == "payment.failed":
            # Payment failed
            user_payment = db.query(UserPayments).filter(UserPayments.razorpay_order_id == order_id).first()
            doctor_payment = db.query(DoctorPayments).filter(DoctorPayments.razorpay_order_id == order_id).first()
            
            payment_record = user_payment or doctor_payment
            
            if payment_record:
                payment_record.payment_status = "failed"
                db.commit()
                logger.warning(f"Webhook: Payment failed for order {order_id}")
            
            return {"status": "failed", "message": "Payment failed"}
        
        else:
            logger.info(f"Unhandled webhook event: {event}")
            return {"status": "unhandled", "message": f"Event {event} not handled"}
    
    except Exception as e:
        db.rollback()
        logger.error(f"Webhook processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Webhook processing error: {e}")
    finally:
        db.close()

async def handle_payment(*args, **kwargs):
    first_arg = args[0] if len(args) > 0 else None
    if first_arg is not None and (hasattr(first_arg, "execute") or hasattr(first_arg, "query") or hasattr(first_arg, "commit")):
        db = first_arg
        passed_db = True
        remaining_args = args[1:]
    else:
        db = SessionLocal()
        passed_db = False
        remaining_args = args

    sender_id = remaining_args[0] if len(remaining_args) > 0 else kwargs.get("sender_id")
    sender_role = remaining_args[1] if len(remaining_args) > 1 else kwargs.get("sender_role")
    reciever_id = remaining_args[2] if len(remaining_args) > 2 else kwargs.get("reciever_id")
    reciever_role = remaining_args[3] if len(remaining_args) > 3 else kwargs.get("reciever_role")
    amount = remaining_args[4] if len(remaining_args) > 4 else kwargs.get("amount")
    note = remaining_args[5] if len(remaining_args) > 5 else kwargs.get("note")
    type = remaining_args[6] if len(remaining_args) > 6 else kwargs.get("type")

    try :
        amount = float(amount)
        if sender_role.lower() not in ["user", "doctor", "hospital", "admin"] or reciever_role.lower() not in ["user", "doctor", "hospital", "admin"]:
            raise HTTPException(status_code = 400, detail = "Invalid role")
        if sender_role == reciever_role and sender_id == reciever_id and type != "TOP-UP":
            raise HTTPException(status_code = 400, detail = "Sender and reciever cannot be same")
        if amount < 0:
            raise HTTPException(status_code = 400, detail = "Amount can not be less than 0")
        # top up wallet
        if type == "TOP-UP" and (sender_role == reciever_role and sender_id == reciever_id):
            if sender_role == "user":
                order = client.order.create({
                    "amount" : int(amount * 100),
                    "currency" : CURRENCY,
                    "payment_capture" : 1
                })
                payment = UserPayments(
                    user_id = sender_id,
                    amount = amount,
                    role = sender_role,
                    type = type,
                    note = note,
                    razorpay_order_id = order.get("id"),
                    payment_status = "pending"
                )
                db.add(payment)
                db.commit()
                db.refresh(payment)
                return {
                    "order" : order,
                    "id" : payment.id,
                    "user_id" : payment.user_id,
                    "amount" : payment.amount,
                    "type" : payment.type,
                    "note" : payment.note,
                    "razorpay_order_id" : order.get("id"),
                    "razorpay_key_id": RAZORPAY_KEY_ID,
                    "message" : "Order created. Proceed to payment verification."
                }
            elif sender_role == "doctor":
                order = client.order.create({
                    "amount" : int(amount * 100),
                    "currency" : CURRENCY,
                    "payment_capture" : 1
                })
                payment = DoctorPayments(
                    doctor_id = sender_id,
                    amount = amount,
                    type = type,
                    note = note,
                    razorpay_order_id = order.get("id"),
                    payment_status = "pending"
                )
                db.add(payment)
                db.commit()
                db.refresh(payment)
                return {
                    "order" : order,
                    "id" : payment.id,
                    "doctor_id" : payment.doctor_id,
                    "amount" : payment.amount,
                    "type" : payment.type,
                    "note" : payment.note,
                    "razorpay_order_id" : order.get("id"),
                    "razorpay_key_id": RAZORPAY_KEY_ID,
                    "message" : "Order created. Proceed to payment verification."
                }
            else :
                raise HTTPException(status_code = 400, detail = "Invalid role")


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
                reciever_wallet.balance += amount_decimal * Decimal(reciever_share)             # 80% to reciever
                if middleman is not None:
                    middleman.balance += amount_decimal * Decimal(middleman_commision)          # middleman_commision% to middleman
                admin_wallet.balance += amount_decimal * Decimal('0.2')                         # 20% to admin
            else:
                admin_wallet.balance += amount_decimal                                          # 100% to admin
                
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
                logger.info(f"Redis cache cleared for {reciever_role} : {reciever_id}")
                logger.info(f"Redis cache cleared for {sender_role} : {sender_id}")
            except Exception as e:
                logger.info(f"Redis cache clear failed (non-critical) : {e}")

        return {
            "status" : "success",
            "transaction_id" : sender_payment.id if sender_payment else None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code = 500, detail = f"Payment failed : {e}")
    finally :
        if not passed_db:
            db.close()

async def handle_refund(reciver_id : int, reciver_role : str, sender_id : int, sender_role : str, amount : float, note : str = None):
    db = SessionLocal()
    try:
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
        return {
            "status" : "success",
            "transaction_id" : reciever_payment.id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code = 500, detail = f"Payment failed : {e}")
    finally :
        db.close()