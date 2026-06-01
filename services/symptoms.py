import asyncio
from typing import Optional
from datetime import date, datetime
from fastapi import HTTPException
from database import SessionLocal
from models import Cases, Doctors, Symptoms
from services.notification import create_notification
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import any_

async def get_symptoms(user_id : int, page : int, limit : int, date : Optional[date] = None):
    db = SessionLocal()
    try :
        query = db.query(Symptoms).filter(Symptoms.user_id == user_id)
        if date is not None:
            start_of_day = datetime.combine(date, datetime.min.time())
            end_of_day = datetime.combine(date, datetime.max.time())
            query = query.filter(Symptoms.date >= start_of_day, Symptoms.date <= end_of_day)
        
        symptoms = query.offset((page - 1) * limit).limit(limit).all()
        
        return [
            {
                "id": s.id,
                "symptom": s.symptom,
                "severity": s.severity,
                "date": s.date.isoformat()
            }
            for s in symptoms
        ]
    except Exception as e:
        raise HTTPException(detail = str(e), status_code = 500)
    finally:
        db.close()

async def add_symptom(symptom : str, severity : int, user_id : int, case_id : Optional[int] = None):
    db = SessionLocal()
    try :
        new_symptom = Symptoms(
            user_id = user_id, 
            symptom = symptom, 
            severity = severity
        )
        db.add(new_symptom)
        db.flush()
        
        if case_id:
            case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user_id).first()
            if not case:
                db.rollback()  # Rollback the symptom we just added
                raise HTTPException(status_code = 404, detail = "Case not found")
            
            # Initialize symptom_ids if None
            if case.symptom_ids is None:
                case.symptom_ids = []
            
            case.symptom_ids = case.symptom_ids + [new_symptom.id]
            case.last_updated = datetime.now()
            doctor = db.query(Doctors).filter(Doctors.id == case.doctor_id).first()
            
            db.commit()
            db.refresh(case)

            # notify doctor
            if doctor:
                asyncio.create_task(
                    create_notification(
                    message = f"Your case with case_id {case.case_id} has been closed by doctor {doctor.name}", 
                    recipient_id = case.user_id, 
                    recipient_role = "user")
                )

            return {
                "note": "Symptom added successfully to case",
                "symptom": new_symptom.symptom,
                "severity": new_symptom.severity,
                "case_id": case.id,
                "doctor_name": doctor.name if doctor else "Unknown",
                "date": new_symptom.date.date(),
                "time": new_symptom.date.time()
            }
        
        db.commit()
        
        return {
            "note": "Symptom added successfully",
            "symptom": new_symptom.symptom,
            "severity": new_symptom.severity,
            "date": new_symptom.date.date(),
            "time": new_symptom.date.time()
        }
    except Exception as e :
        db.rollback()
        raise HTTPException(status_code = 500, detail = str(e))
    finally:
        db.close()

async def update_symptom_fc(symptom_id : int, symptom : str, severity : int, user_id : int):
    db = SessionLocal()
    try : 
        symptom = db.query(Symptoms).filter(Symptoms.id == symptom_id, Symptoms.user_id == user_id).first()
        if not symptom:
            raise HTTPException(status_code = 404, detail = "Symptom not found")

        symptom.symptom = symptom
        symptom.severity = severity 

        db.commit()
        db.refresh(symptom)

        return {
            "note" : "Symptom updated successfully",
            "id" : symptom.id,
            "symptom" : symptom.symptom,
            "severity" : symptom.severity
        }
    except Exception as e :
        db.rollback()
        raise HTTPException(status_code = 500, detail = str(e))
    finally:
        db.close()

async def delete_symptom_fc(
    symptom_id : int, 
    user_id : int, 
    user_name : str,
    force : bool = False
):
    db = SessionLocal()
    try :
        # Find the symptom
        symptom = db.query(Symptoms).filter(Symptoms.id == symptom_id,  Symptoms.user_id == user_id).first()
        if not symptom:
            raise HTTPException(status_code=404, detail="Symptom not found")

        # FIXED: Query cases where symptom_id exists in the INTEGER[] array
        cases = db.query(Cases).filter(any_(Cases.symptom_ids) == symptom_id).all()
        
        if cases and not force:
            case_ids = [c.case_id for c in cases]
            raise HTTPException(status_code = 400,  detail = f"Symptom is attached to {len(cases)} case(s): {case_ids}. Use ?force=true to delete anyway.")
        
        # Remove symptom from each case's INTEGER[] array
        for case in cases:
            if case.symptom_ids:
                # Filter out the symptom_id from the array
                case.symptom_ids = [
                    sid for sid in case.symptom_ids 
                    if sid != symptom_id
                ]
                # CRITICAL: Notify SQLAlchemy that the array was modified in-place
                flag_modified(case, "symptom_ids")
                case.last_updated = datetime.now()
                # Handle notification in background task
                asyncio.create_task(
                    create_notification(
                    message = f"User {user_name} has deleted symptom {symptom_id}",
                    recipient_id = case.doctor_id,
                    recipient_role = "doctor")
                )
        
        # Delete the symptom
        db.delete(symptom)
        
        # Single commit for all changes
        db.commit()

        return {
            "note": "Symptom deleted successfully",
            "id": symptom_id,
            "cases_affected": len(cases)
        }
    except Exception as e:
        raise HTTPException(status_code = 400, detail = str(e))
    finally:
        db.close()

