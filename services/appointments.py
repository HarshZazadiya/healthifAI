import asyncio
from sqlalchemy import func
from typing import Optional
from datetime import datetime
from logs.logging import logger
from database import SessionLocal
from fastapi import HTTPException
from services.notification import create_notification
from services.payment import handle_payment, handle_refund
from models import Cases, Doctors, Hospitals, Appointments, Users

async def get_appointments(
    requester_id : int, 
    requester_role : str, 
    page : int = 1, 
    limit : int = 20, 
    status : Optional[str] = None, 
    date : Optional[datetime] = None
):
    db = SessionLocal()
    try : 
        if requester_role == "user":
            query = db.query(Appointments).filter(Appointments.user_id == requester_id)

            if status:
                query = query.filter(Appointments.status == status)
            if date :
                start_of_day = datetime.combine(date, datetime.min.time())
                end_of_day = datetime.combine(date, datetime.max.time())
                query = query.filter(Appointments.date >= start_of_day, Appointments.date <= end_of_day)
            appointments = query.offset((page - 1) * limit).limit(limit).all()
            
            if not appointments:
                return []
            
            doctor_ids = [app.doctor_id for app in appointments]
            case_ids = [app.case_id for app in appointments if app.case_id]
            
            doctors = {d.id: d for d in db.query(Doctors).filter(Doctors.id.in_(doctor_ids)).all()}
            
            hospital_ids = [d.hospital_id for d in doctors.values()]
            hospitals = {h.id: h for h in db.query(Hospitals).filter(Hospitals.id.in_(hospital_ids)).all()}
            
            cases = {c.id: c for c in db.query(Cases).filter(Cases.id.in_(case_ids)).all()} if case_ids else {}
            
            data = []
            for appointment in appointments:
                doctor = doctors.get(appointment.doctor_id)
                hospital = hospitals.get(doctor.hospital_id) if doctor else None
                case = cases.get(appointment.case_id)
                

                data.append({
                    "id" : appointment.id,
                    "date" : appointment.date.isoformat(),
                    "status" : appointment.status,
                    "doctor_id" : appointment.doctor_id,
                    "doctor_name" : doctor.name if doctor else "Unknown",
                    "doctor_phone_number" : doctor.phone_number if doctor else "Unknown",
                    "doctor_email" : doctor.email if doctor else "Unknown",
                    "case_id" : case.case_id if case else None,
                    "hospital_name" : hospital.name if hospital else "Unknown",
                    "address" : f"{hospital.address}, {hospital.city}, {hospital.state}, {hospital.zip}" if hospital else "Unknown"
                })
            return data
        elif requester_role == "doctor":
            # Build query with joins to avoid N+1 queries
            query = db.query(Appointments).filter(Appointments.doctor_id == requester_id)
            
            if date is not None:
                start_of_day = datetime.combine(date, datetime.min.time())
                end_of_day = datetime.combine(date, datetime.max.time())
                query = query.filter(Appointments.date >= start_of_day, Appointments.date <= end_of_day)
            if status is not None:
                query = query.filter(Appointments.status == status)
            appointments = query.order_by(Appointments.date.desc()).offset((page - 1) * limit).limit(limit).all()

            user_ids = [apt.user_id for apt in appointments]
            users = {user.id : user for user in db.query(Users).filter(Users.id.in_(user_ids)).all()}
            
            case_ids = [apt.case_id for apt in appointments if apt.case_id]
            cases = {case.id : case for case in db.query(Cases).filter(Cases.id.in_(case_ids)).all()}
            
            data = []
            for appointment in appointments:
                user = users.get(appointment.user_id)
                case = cases.get(appointment.case_id) if appointment.case_id else None
                
                data.append({
                    "id" : appointment.id,
                    "date" : appointment.date.isoformat(),
                    "status" : appointment.status,
                    "user_id" : appointment.user_id,
                    "username" : user.name if user else "Unknown",
                    "case_id" : appointment.case_id,
                    "case_number" : case.case_id if case else None,
                })
            
            return {
                "total" : len(data),
                "appointments" : data
            }
        elif requester_role == "hospital":
            cases = db.query(Cases).filter(Cases.hospital_id == hospital.id).all()
            if not cases:
                raise HTTPException(404, "No cases found, Hence no Appointments")
            case_ids = [case.id for case in cases]
            appointments = db.query(Appointments).filter(Appointments.case_id.in_(case_ids)).all()
            case_map = {case.id : case for case in cases}
            data = []
            for app in appointments:
                case = case_map.get(app.case_id)
                if not case:
                    logger.info(f"Case not found for appointment {app.id}")
                    continue
                data.append({
                    "id" : app.id,
                    "date" : app.date.date(),
                    "time" : app.date.time(),
                    "case" : case.id,
                    "casePid" : case.case_id,
                    "diesease" : case.diesease,
                    "doctor_info" : [doc.name for doc in db.query(Doctors).filter(Doctors.id == app.doctor_id).all()],
                    "user_info" : [user.name for user in db.query(Users).filter(Users.id == app.user_id).all()],
                    "status" : app.status
                })
            return data
        else :
            raise HTTPException(status_code = 401, detail = "Unauthorized access")
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e))

async def add_appointment(user_id : int, user_role : str, user_name : str, doctor_id : int, date : datetime):
    db = SessionLocal()
    try : 
        case = db.query(Cases).filter(Cases.doctor_id == doctor_id, Cases.user_id == user_id, Cases.status == "OPEN").first()
        if not case:
            raise HTTPException(status_code = 404, detail = "Case not found")

        doctor = db.query(Doctors).filter(Doctors.id == doctor_id, Doctors.is_active == True).first()
        if not doctor:
            raise HTTPException(status_code = 404, detail = "Doctor not found")
        if not doctor.availability:
            raise HTTPException(status_code = 400, detail = "Doctor is not available")

        doctor_name = doctor.name
        doctor_appointment_fees = doctor.appointment_fees
        doctor_fees = doctor.fees  
        new_appointment = Appointments(
            user_id = user_id,
            doctor_id = doctor_id,
            case_id = case.id,
            date = date,
            status = "PENDING"
        )

        case.last_updated = datetime.now()

        result = await handle_payment(db, user_id, user_role, doctor_id, "doctor", doctor_fees, note = f"Appointment Fees of doctor {doctor_name}")

        db.add(new_appointment)
        db.commit()
        db.refresh(new_appointment)

        asyncio.create_task(
            create_notification(message = f"You have a new appointment request from user {user_name}", recipient_id = doctor_id, recipient_role = "doctor")
        )

        return {
            "note" : f"Appointment Booked for doctor {doctor_name} Successfully",
            "transaction_id" : result["transaction_id"] if result else None,
            "amount" : doctor_appointment_fees,
            "message" : "You will get a confirmation mail from our side before 24 hours of appointment. Please keep checking your email for updates."
        }
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e)) 
    finally :
        db.close()

async def update_appointment_fc(appointment_id : int, user_id : int, user_name : str, user_role : str, date : datetime):
    db = SessionLocal()
    try :
        appointment = db.query(Appointments).filter(Appointments.id == appointment_id, Appointments.user_id == user_id).first()
        if not appointment:
            raise HTTPException(status_code = 404, detail = "Appointment not found")

        appointment.date = date

        db.commit()
        db.refresh(appointment)
        asyncio.create_task(
            create_notification(message = f"user {user_name} has the appointment of case {appointment.case_id}", recipient_id = appointment.doctor_id, recipient_role = "doctor")
        )
        return {
            "note" : "Appointment updated successfullys",
            "id" : appointment.id,
            "doctor_id" : appointment.doctor_id,
            "date" : appointment.date.isoformat()
        }
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e)) 
    finally :
        db.close()

async def cancel_appointment_fc(appointment_id : int, user_id : int, user_name : str, user_role : str, date : Optional[datetime] = None):
    db = SessionLocal()
    try :
        if user_role == "user" :
            appointment = db.query(Appointments).filter(Appointments.id == appointment_id, Appointments.user_id == user_id).first()
            if not appointment:
                raise HTTPException(status_code = 404, detail = "Appointment not found")
            
            if appointment.status == "CANCELLED":
                raise HTTPException(status_code = 400, detail = "Appointment already cancelled")

            if appointment.date < datetime.now():
                raise HTTPException(status_code = 400, detail = "Cannot cancel an appointment in the past")

            # remove the price from case's cost
            case = db.query(Cases).filter(Cases.id == appointment.case_id).first()
            doctor = db.query(Doctors).filter(Doctors.id == appointment.doctor_id).first()
            case.cost -= doctor.appointment_fees
            case.last_updated = datetime.now()
            db.refresh(case)

            # refund the payment
            await handle_refund(user_id,  user_role,  appointment.doctor_id,  "doctor",  doctor.fees,  note = f"Refund for cancelled appointment of case {case.case_id}")

            # Cancel the appointment
            db.delete(appointment)
            db.commit()

            asyncio.create_task(
                create_notification(
                    message = f"user {user_name} has cancelled an appointment {appointment_id} of time {appointment.date}", 
                    recipient_id = appointment.doctor_id, 
                    recipient_role = "doctor"
                )
            )

            return {
                "note" : "Appointment cancelled successfully",
                "id" : appointment_id
            }
        if user_role == "doctor" :
            doctor = db.query(Doctors).filter(Doctors.id == user_id).first()
            if not doctor:
                raise HTTPException(status_code = 404, detail = "Doctor not found")
            base_query = db.query(Appointments).filter(Appointments.doctor_id == user_id)
    
            # if appointment_id is provided then cancel that appointment only if it belongs to the doctor
            if appointment_id is not None:
                base_query = base_query.filter(Appointments.id == appointment_id)
            # if date is provided then cancel all appointments of the doctor on that date
            elif date is not None:
                only_date = date.date()
                base_query = base_query.filter(func.date(Appointments.date) == only_date)
            
            appointments = base_query.all()
            # if no appointments is found then throw error
            if not appointments:
                raise HTTPException(status_code = 404, detail = "Appointment not found")
            try:
                # if the appointments are already cancelled then throw error
                for app in appointments:
                    if app.status == "CANCELLED":
                        raise HTTPException(status_code = 400, detail = "Appointment already cancelled")
            
                for app in appointments:
                    asyncio.create_task(
                        create_notification(
                            message = f"Appointment {app.id} of user {app.user_id} has been cancelled by doctor {user_name}", 
                            recipient_id = app.user_id, 
                            recipient_role = "user"
                        )
                    )

                    # remove the price from case's cost
                    case = db.query(Cases).filter(Cases.id == app.case_id).first()
                    case.cost -= doctor.appointment_fees
                    case.last_updated = datetime.now()
                    db.refresh(case)
                    
                    # refund the payment
                    await handle_refund(app.user_id, "user", doctor.id, "doctor", doctor.appointment_fees, note = f"Refund for cancelled appointment of case {case.case_id}")
                    
                    # Cancel the appointment
                    app.status = "CANCELLED"
                    
                    db.commit()
            except Exception as e:
                # rollback the transaction
                db.rollback()
                raise HTTPException(status_code = 400, detail = e)
            
            db.commit()
            return {
                "note" : "Appointments cancelled successfully",
                "deleted" : True,
                "deleted_count" : len(appointments)
            }
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e)) 
    finally :
        db.close()

async def complete_appointment_fc(appointment_id, user_id, role):
    db = SessionLocal()
    try :
        appointment = db.query(Appointments).filter(Appointments.id == appointment_id).first()
        if not appointment:
            raise ValueError("Appointment not found")

        if role != "doctor":
            raise HTTPException(status_code = 403, detail = "You are not authorized to complete this appointment")
        elif role == "doctor" and appointment.doctor_id != user_id:
            raise ValueError("Doctor can only complete their own appointments")
        else : 
            appointment.status = "COMPLETED"
            db.commit()
            return {
                "note" : "Appointment completed successfully",
                "id" : appointment_id,
                "status" : appointment.status
            }

    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e)) 
    finally :
        db.close()

async def get_all_appointments_for_hospital(hospital_id : int):
    db = SessionLocal()
    try :
        cases = db.query(Cases).filter(Cases.hospital_id == hospital_id).all()
        if not cases:
            raise HTTPException(404, "No cases found, Hence no Appointments")
        case_ids = [case.id for case in cases]
        appointments = db.query(Appointments).filter(Appointments.case_id.in_(case_ids)).all()
        case_map = {case.id : case for case in cases}
        data = []
        for app in appointments:
            case = case_map.get(app.case_id)
            if not case:
                logger.info(f"Case not found for appointment {app.id}")
                continue
            data.append({
                "id" : app.id,
                "date" : app.date.date(),
                "time" : app.date.time(),
                "case" : case.id,
                "casePid" : case.case_id,
                "diesease" : case.diesease,
                "doctor_info" : [doc.name for doc in db.query(Doctors).filter(Doctors.id == app.doctor_id).all()],
                "user_info" : [user.name for user in db.query(Users).filter(Users.id == app.user_id).all()],
                "status" : app.status
            })
        return data
    except Exception as e :
        raise HTTPException(status_code = 400, detail = str(e)) 
    finally :
        db.close()
