from decimal import Decimal
import os
import asyncio
from typing import List
from typing import Optional
from urllib.parse import urljoin
from database import SessionLocal
from datetime import datetime
from fastapi import HTTPException, Query
from services.notification import create_notification
from services.payment import handle_payment
from utils.signed_url_generator import generate_signed_url
from models import AssignedDoctors, Users, Doctors, Hospitals, Cases, Documents, Symptoms

BASE_URL = os.getenv("BASE_URL")

async def get_users_cases(
    user_id : int,
    status : Optional[str] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(4, ge = 1, le = 100),
    from_date : Optional[datetime] = None,
    to_date : Optional[datetime] = None,
    doctor_id : Optional[int] = None,
    case_id : Optional[int] = None
):
    db = SessionLocal()
    try :
        query = db.query(Cases).filter(Cases.user_id == user_id)
        
        if not case_id:
            if status:
                query = query.filter(Cases.status == status)
            if from_date:
                query = query.filter(Cases.date >= from_date)
            if to_date:
                query = query.filter(Cases.date <= to_date)
            if doctor_id:
                query = query.filter(Cases.doctor_id == doctor_id)
            
            total = query.count()
            cases = query.order_by(Cases.date.desc()).offset((page - 1) * limit).limit(limit).all()
            
            # Batch fetch all related data
            doctor_ids = list(set([c.doctor_id for c in cases]))
            doctors = {d.id : d.name for d in db.query(Doctors).filter(Doctors.id.in_(doctor_ids)).all()}
            
            hospital_ids = list(set([c.hospital_id for c in cases]))
            hospitals = {h.id : h.name for h in db.query(Hospitals).filter(Hospitals.id.in_(hospital_ids)).all()}
            
            all_doc_ids = set()
            all_symptom_ids = set()
            for case in cases:
                all_doc_ids.update(case.user_doc_ids or [])
                all_doc_ids.update(case.doctor_doc_ids or [])
                all_symptom_ids.update(case.symptom_ids or [])
            
            # Fetch documents
            documents = db.query(Documents).filter(Documents.id.in_(all_doc_ids)).all() if all_doc_ids else []
            doc_map = {doc.id: {
                "id" : doc.id,
                "url" : urljoin(BASE_URL, await generate_signed_url(doc.document_path, user_id, "user", doc.id)),
                "type" : doc.type,
                "date" : doc.date.isoformat()
            } for doc in documents}
            
            # Fetch symptoms
            symptoms = db.query(Symptoms).filter(Symptoms.id.in_(all_symptom_ids)).all() if all_symptom_ids else []
            symptom_map = {s.id: s for s in symptoms}
            
            # Build response - ONLY ONE LOOP
            result = []
            for case in cases:
                # Build symptoms for this case
                case_symptoms = []
                if case.symptom_ids:
                    for s_id in case.symptom_ids:
                        if s_id in symptom_map:
                            case_symptoms.append({
                                "id" : s_id,
                                "name" : symptom_map.get(s_id).symptom,
                                "severity" : symptom_map.get(s_id).severity
                            })
                
                result.append({
                    "id" : case.id,
                    "case_id" : case.case_id,
                    "status" : case.status,
                    "doctor_name" : doctors.get(case.doctor_id),
                    "hospital_name" : hospitals.get(case.hospital_id),
                    "case_opened_on" : case.date.isoformat(),
                    "case_updated_on" : case.last_updated.isoformat() if case.last_updated else None,
                    "documents" : {
                        "user" : [doc_map.get(doc_id) for doc_id in (case.user_doc_ids or []) if doc_map.get(doc_id)],
                        "doctor" : [doc_map.get(doc_id) for doc_id in (case.doctor_doc_ids or []) if doc_map.get(doc_id)]
                    },
                    "symptoms" : case_symptoms ,
                    "cost" : case.cost,
                    "diesease" : case.diesease
                })
        else:
            case = query.filter(Cases.id == case_id).first()
            if not case:
                raise HTTPException(404, "Case not found")
            
            doctor = db.query(Doctors).filter(Doctors.id == case.doctor_id).first()
            hospital = db.query(Hospitals).filter(Hospitals.id == doctor.hospital_id).first() if doctor else None
            
            all_doc_ids = set(case.user_doc_ids or []) | set(case.doctor_doc_ids or [])
            documents = db.query(Documents).filter(Documents.id.in_(all_doc_ids)).all() if all_doc_ids else []
            doc_map = {doc.id: {
                "id" : doc.id,
                "url" : urljoin(BASE_URL, await generate_signed_url(doc.document_path, user_id, "user", doc.id)),
                "type" : doc.type,
                "date" : doc.date.isoformat()
            } for doc in documents}
            
            symptom_ids = set(case.symptom_ids or [])
            symptoms = db.query(Symptoms).filter(Symptoms.id.in_(symptom_ids)).all() if symptom_ids else []
            symptom_map = {s.id : s.symptom for s in symptoms}
            
            case_symptoms = []
            if case.symptom_ids:
                for s_id in case.symptom_ids:
                    if s_id in symptom_map:
                        case_symptoms.append({
                            "id" : s_id,
                            "name" : symptom_map[s_id]
                        })
            
            total = 1
            result = [{
                "id" : case.id,
                "case_id" : case.case_id,
                "status" : case.status,
                "doctor_name" : doctor.name if doctor else None,
                "hospital_name" : hospital.name if hospital else None,
                "case_opened_on" : case.date.isoformat(),
                "case_updated_on" : case.last_updated.isoformat() if case.last_updated else None,
                "documents" : {
                    "user" : [doc_map.get(doc_id) for doc_id in (case.user_doc_ids or []) if doc_map.get(doc_id)],
                    "doctor" : [doc_map.get(doc_id) for doc_id in (case.doctor_doc_ids or []) if doc_map.get(doc_id)]
                },
                "symptoms" : case_symptoms,
                "cost" : case.cost,
                "diesease" : case.diesease
            }]

        return {
            "total" : total,
            "limit" : limit,
            "page"  : page,
            "cases" : result
        }
    except Exception as e :
        print(e)
        raise HTTPException(500, "Internal server error")
    finally :
        db.close()

async def get_doctors_cases(
    doctor_id : int,
    status : Optional[str] = None,
    from_date : Optional[datetime] = None,
    to_date : Optional[datetime] = None,
    user_id : Optional[int] = None,
    case_id : Optional[int] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100),
):
    db = SessionLocal()
    try: 
        query = db.query(Cases).filter(Cases.doctor_id == doctor_id)
        
        if not case_id:
            if status:
                query = query.filter(Cases.status == status)
            if from_date:
                query = query.filter(Cases.date >= from_date)
            if to_date:
                query = query.filter(Cases.date <= to_date)
            if user_id:
                query = query.filter(Cases.user_id == user_id)
            
            total = query.count()
            cases = query.order_by(Cases.date.desc()).offset((page - 1) * limit).limit(limit).all()
            
            # Batch fetch all related data
            user_ids = list(set([c.user_id for c in cases]))
            users = {u.id : u for u in db.query(Users).filter(Users.id.in_(user_ids)).all()}
            
            all_doc_ids = set()
            all_symptom_ids = set()
            for case in cases:
                all_doc_ids.update(case.user_doc_ids or [])
                all_doc_ids.update(case.doctor_doc_ids or [])
                all_symptom_ids.update(case.symptom_ids or [])
            
            # Fetch documents
            documents = db.query(Documents).filter(Documents.id.in_(all_doc_ids)).all() if all_doc_ids else []
            doc_map = {doc.id: {
                "id" : doc.id,
                "url" : urljoin(BASE_URL, await generate_signed_url(doc.document_path, doctor_id, "doctor", doc.id)),
                "type" : doc.type,
                "date" : doc.date.isoformat()
            } for doc in documents}
            
            # Fetch symptoms
            symptoms = db.query(Symptoms).filter(Symptoms.id.in_(all_symptom_ids)).all() if all_symptom_ids else []
            symptom_map = {s.id: {"name": s.symptom, "severity": s.severity} for s in symptoms}
            
            # Build response - ONLY ONE LOOP
            result = []
            for case in cases:            
                # Build symptoms for this case
                case_symptoms = []
                if case.symptom_ids:
                    for s_id in case.symptom_ids:
                        if s_id in symptom_map:
                            case_symptoms.append({
                                "id" : s_id,
                                "name" : symptom_map[s_id]["name"],
                                "severity" : symptom_map[s_id]["severity"]
                            })
                user  = users.get(case.user_id)
                result.append({
                    "id" : case.id,
                    "case_id" : case.case_id,
                    "status" : case.status,
                    "user_name" : user.name if user else None,
                    "user_email" : user.email if user else None,
                    "user_phone_number" : user.phone_number if user else None,
                    "user_lat" : user.lat if user else None,
                    "user_lon" : user.lon if user else None,  
                    "case_opened_on" : case.date.isoformat(),
                    "case_updated_on" : case.last_updated.isoformat() if case.last_updated else None,
                    "documents" : {
                        "user" : [doc_map.get(doc_id) for doc_id in (case.user_doc_ids or []) if doc_map.get(doc_id)],
                        "doctor" : [doc_map.get(doc_id) for doc_id in (case.doctor_doc_ids or []) if doc_map.get(doc_id)]
                    },
                    "symptoms" : case_symptoms
                })
        else:
            case = query.filter(Cases.id == case_id).first()
            if not case:
                raise HTTPException(404, "Case not found")
            
            user = db.query(Users).filter(Users.id == case.user_id).first()
            if not user:
                raise HTTPException(404, "User not found")
            all_doc_ids = set(case.user_doc_ids or []) | set(case.doctor_doc_ids or [])
            documents = db.query(Documents).filter(Documents.id.in_(all_doc_ids)).all() if all_doc_ids else []
            doc_map = {doc.id : {
                "id" : doc.id,
                "url" : urljoin(BASE_URL, await generate_signed_url(doc.document_path, doctor_id, "doctor", doc.id)),
                "type" : doc.type,
                "date" : doc.date.isoformat()
            } for doc in documents}
            
            symptom_ids = set(case.symptom_ids or [])
            symptoms = db.query(Symptoms).filter(Symptoms.id.in_(symptom_ids)).all() if symptom_ids else []
            symptom_map = {s.id: {"name": s.symptom, "severity": s.severity} for s in symptoms}
            
            case_symptoms = []
            if case.symptom_ids:
                for s_id in case.symptom_ids:
                    if s_id in symptom_map:
                        case_symptoms.append({
                            "id" : s_id,
                            "name" : symptom_map[s_id]["name"],
                            "severity" : symptom_map[s_id]["severity"]
                        })
            
            total = 1
            result = [{
                "id" : case.id,
                "case_id" : case.case_id,
                "status" : case.status,
                "user_name" : user.name,
                "user_email" : user.email,
                "user_phone_number" : user.phone_number,
                "user_lat" : user.lat,
                "user_lon" : user.lon,
                "case_opened_on" : case.date.isoformat(),
                "case_updated_on" : case.last_updated.isoformat(),
                "documents" : {
                    "user" : [doc_map.get(doc_id) for doc_id in (case.user_doc_ids or []) if doc_map.get(doc_id)],
                    "doctor" : [doc_map.get(doc_id) for doc_id in (case.doctor_doc_ids or []) if doc_map.get(doc_id)]
                },
                "symptoms" : case_symptoms
            }]
        
        return {
            "total" : total,
            "limit" : limit,
            "page" : page,
            "cases" : result
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally :
        db.close()

async def get_hospitals_cases(
    hospital_id : int,
    status : Optional[str] = None,
    from_date : Optional[datetime] = None,
    to_date : Optional[datetime] = None,
    doctor_id : Optional[int] = None,
    case_id : Optional[int] = None,
    page : int = Query(1, ge = 1),
    limit : int = Query(20, ge = 1, le = 100),
):
    db = SessionLocal()
    try:
        # Base query: all cases of this hospital
        query = db.query(Cases).filter(Cases.hospital_id == hospital_id)

        # If case_id is provided, return single case (ignore pagination)
        if case_id:
            case = query.filter(Cases.id == case_id).first()
            if not case:
                raise HTTPException(404, "Case not found")

            # Fetch user
            user = db.query(Users).filter(Users.id == case.user_id).first()
            if not user:
                raise HTTPException(404, "User not found")

            # Fetch doctor if assigned
            doctor = None
            if case.doctor_id:
                doctor = db.query(Doctors).filter(Doctors.id == case.doctor_id).first()

            # Collect document IDs
            all_doc_ids = set(case.user_doc_ids or []) | set(case.doctor_doc_ids or [])
            documents = []
            doc_map = {}
            if all_doc_ids:
                documents = db.query(Documents).filter(Documents.id.in_(all_doc_ids)).all()
                for doc in documents:
                    # Generate signed URL for each document using hospital's credentials
                    signed_path = await generate_signed_url(
                        doc.document_path, hospital_id, "hospital", doc.id
                    )
                    doc_map[doc.id] = {
                        "id": doc.id,
                        "url": urljoin(BASE_URL, signed_path),
                        "type": doc.type,
                        "date": doc.date.isoformat(),
                    }

            # Fetch symptoms
            symptom_ids = set(case.symptom_ids or [])
            symptoms = []
            symptom_map = {}
            if symptom_ids:
                symptoms = db.query(Symptoms).filter(Symptoms.id.in_(symptom_ids)).all()
                symptom_map = {s.id: {"name": s.symptom, "severity": s.severity} for s in symptoms}

            # Build symptoms list for this case
            case_symptoms = []
            if case.symptom_ids:
                for s_id in case.symptom_ids:
                    if s_id in symptom_map:
                        case_symptoms.append({
                            "id": s_id,
                            "name": symptom_map[s_id]["name"],
                            "severity": symptom_map[s_id]["severity"],
                        })

            result = [{
                "id": case.id,
                "case_id": case.case_id,
                "status": case.status,
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "phone_number": user.phone_number,
                    "lat": user.lat,
                    "lon": user.lon,
                },
                "doctor": {
                    "id": doctor.id if doctor else None,
                    "name": doctor.name if doctor else "Not assigned",
                    "email": doctor.email if doctor else None,
                    "speciality": doctor.speciality if doctor else None,
                } if doctor else None,
                "case_opened_on": case.date.isoformat(),
                "case_updated_on": case.last_updated.isoformat() if case.last_updated else None,
                "documents": {
                    "user": [doc_map.get(doc_id) for doc_id in (case.user_doc_ids or []) if doc_map.get(doc_id)],
                    "doctor": [doc_map.get(doc_id) for doc_id in (case.doctor_doc_ids or []) if doc_map.get(doc_id)],
                },
                "symptoms": case_symptoms,
            }]

            return {
                "total": 1,
                "limit": limit,
                "page": 1,
                "cases": result,
            }

        # --- Paginated multiple cases ---
        if status:
            query = query.filter(Cases.status == status)
        if from_date:
            query = query.filter(Cases.date >= from_date)
        if to_date:
            query = query.filter(Cases.date <= to_date)
        if doctor_id:
            query = query.filter(Cases.doctor_id == doctor_id)

        total = query.count()
        cases = query.order_by(Cases.date.desc()).offset((page - 1) * limit).limit(limit).all()

        if not cases:
            return {
                "total": 0,
                "limit": limit,
                "page": page,
                "cases": [],
            }

        # Batch fetch related data
        user_ids = list({c.user_id for c in cases})
        doctor_ids = list({c.doctor_id for c in cases if c.doctor_id})

        users = {u.id: u for u in db.query(Users).filter(Users.id.in_(user_ids)).all()}
        doctors = {d.id: d for d in db.query(Doctors).filter(Doctors.id.in_(doctor_ids)).all()}

        # Collect all document and symptom IDs
        all_doc_ids = set()
        all_symptom_ids = set()
        for case in cases:
            all_doc_ids.update(case.user_doc_ids or [])
            all_doc_ids.update(case.doctor_doc_ids or [])
            all_symptom_ids.update(case.symptom_ids or [])

        # Fetch documents and generate signed URLs
        doc_map = {}
        if all_doc_ids:
            documents = db.query(Documents).filter(Documents.id.in_(all_doc_ids)).all()
            for doc in documents:
                signed_path = await generate_signed_url(
                    doc.document_path, hospital_id, "hospital", doc.id
                )
                doc_map[doc.id] = {
                    "id": doc.id,
                    "url": urljoin(BASE_URL, signed_path),
                    "type": doc.type,
                    "date": doc.date.isoformat(),
                }

        # Fetch symptoms
        symptom_map = {}
        if all_symptom_ids:
            symptoms = db.query(Symptoms).filter(Symptoms.id.in_(all_symptom_ids)).all()
            symptom_map = {s.id: {"name": s.symptom, "severity": s.severity} for s in symptoms}

        # Build result list
        result = []
        for case in cases:
            user = users.get(case.user_id)
            doctor = doctors.get(case.doctor_id) if case.doctor_id else None

            # Build symptoms for this case
            case_symptoms = []
            if case.symptom_ids:
                for s_id in case.symptom_ids:
                    if s_id in symptom_map:
                        case_symptoms.append({
                            "id": s_id,
                            "name": symptom_map[s_id]["name"],
                            "severity": symptom_map[s_id]["severity"],
                        })

            result.append({
                "id": case.id,
                "case_id": case.case_id,
                "status": case.status,
                "user": {
                    "id": user.id if user else None,
                    "name": user.name if user else "Unknown",
                    "email": user.email if user else None,
                    "phone_number": user.phone_number if user else None,
                    "lat": user.lat if user else None,
                    "lon": user.lon if user else None,
                },
                "doctor": {
                    "id": doctor.id if doctor else None,
                    "name": doctor.name if doctor else "Not assigned",
                    "email": doctor.email if doctor else None,
                    "speciality": doctor.speciality if doctor else None,
                } if doctor else None,
                "case_opened_on": case.date.isoformat(),
                "case_updated_on": case.last_updated.isoformat() if case.last_updated else None,
                "documents": {
                    "user": [doc_map.get(doc_id) for doc_id in (case.user_doc_ids or []) if doc_map.get(doc_id)],
                    "doctor": [doc_map.get(doc_id) for doc_id in (case.doctor_doc_ids or []) if doc_map.get(doc_id)],
                },
                "symptoms": case_symptoms,
            })

        return {
            "total": total,
            "limit": limit,
            "page": page,
            "cases": result,
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally :
        db.close()

async def add_symptom_tc(case_id : int, user_id : int, user_name : str, symptom_ids : List[int] = None):
    db = SessionLocal()
    try : 
        if not symptom_ids:
            raise HTTPException(status_code = 400, detail = "Please provide at least one symptom id")
        case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user_id).first()
        if not case:
            raise HTTPException(status_code = 404, detail = "Case not found")
        for symptom_id in symptom_ids:
            symptom = db.query(Symptoms).filter(Symptoms.id == symptom_id, Symptoms.user_id == user_id).first()
            if not symptom:
                raise HTTPException(status_code = 404, detail = f"Symptom not found for symptom : {symptom_id}")
            if symptom_id in case.symptom_ids:
                raise HTTPException(status_code = 400, detail = f"Symptom with id {symptom_id} is already added to the case")
            case.symptom_ids = case.symptom_ids + [symptom_id] if case.symptom_ids else [symptom_id]
        case.last_updated = datetime.now()
        db.commit()
        db.refresh(case)
        asyncio.create_task(
            create_notification(
            message = f"user {user_name} has a new added symptoms to case {case.case_id}", 
            recipient_id = case.doctor_id, 
            recipient_role = "doctor")
        )
        return {
            "note" : "Symptoms added successfully to case",
            "case" : case.id,
            "case_id" : case.case_id,
            "symptom_ids" : case.symptom_ids
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally :
        db.close()

async def add_documents_tc(case_id : int, user_id : int, user_name : str, document_ids : List[int] = None):
    db = SessionLocal()
    try :
        if not document_ids:
            raise HTTPException(status_code = 400, detail = "Please provide at least one document id")
        case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user_id).first()
        if not case:
            raise HTTPException(status_code = 404, detail = "Case not found")
        
        for document_id in document_ids:
            if document_id in case.user_doc_ids :
                raise HTTPException(status_code = 400, detail = f"Document with id {document_id} is already added to the case")
            document = db.query(Documents).filter(Documents.id == document_id, Documents.user_id == user_id).first()
            if not document:
                raise HTTPException(status_code = 404, detail = f"Document not found for document : {document_id}")
            case.user_doc_ids = case.user_doc_ids + [document_id] if case.user_doc_ids else [document_id]
        
        case.last_updated = datetime.now()
        db.commit()
        db.refresh(case)
        asyncio.create_task(
            create_notification(
            message = f"user {user_name} has a new added document to case {case.case_id}", 
            recipient_id = case.doctor_id, 
            recipient_role = "doctor")
        )
        return {
            "note" : "Documents added successfully to case",
            "case" : case.id,
            "case_id" : case.case_id,
            "user_document_ids" : case.user_doc_ids,
            "doctor_document_ids" : case.doctor_doc_ids
        }    
    except Exception as e:
        raise HTTPException(500, str(e))    
    finally :
        db.close()

async def close_the_case(case_id : int, user_id : int, user_name : str, user_role : str):
    close = 0
    if user_role == "user":
        try : 
            db = SessionLocal()
            case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user_id, Cases.status != "CLOSED").first()
            if not case:
                raise HTTPException(status_code = 404, detail = "Case not found")
            
            if case.status == "REQUESTED_BY_DOCTOR":
                case.status = "CLOSED"
                close = 1
                asyncio.create_task(
                    create_notification(
                    message = f"user {user_name} has closed the case {case.case_id}", 
                    recipient_id = case.doctor_id, 
                    recipient_role = "doctor")
                )
            elif case.status == "OPEN":
                case.status = "REQUESTED_BY_USER"
                asyncio.create_task(
                    create_notification(
                    message = f"user {user_name} has requested to close the case {case.case_id}", 
                    recipient_id = case.doctor_id, 
                    recipient_role = "doctor")
                )
            elif case.status not in ["REQUESTED_BY_USER", "REQUESTED_BY_DOCTOR", "CLOSED"]:
                raise HTTPException(status_code = 400, detail = "Invalid status")
            
            # deassign the doctor if case got closed
            if close == 1:
                doctor_id = case.doctor_id
                assigned = db.query(AssignedDoctors).filter(AssignedDoctors.user_id == user_id, AssignedDoctors.doctor_id == doctor_id).first()
                if assigned:
                    db.delete(assigned)

            case.last_updated = datetime.now()
            db.commit()
            db.refresh(case)
            return {
                "note" : "Case closed successfully" if case.status == "CLOSED" else "Case closure requested successfully",
                "case" : case.id,
                "case_id" : case.case_id,
                "status" : case.status,
            }
        except Exception as e:
            raise HTTPException(500, str(e))
        finally :
            db.close()
    
    elif user_role == "doctor" :
        # doctor can only close the case if its assigned to him and is not already closed
        try :
            db = SessionLocal()
            case = db.query(Cases).filter(Cases.id == case_id, Cases.doctor_id == user_id, Cases.status != "CLOSED").first()
            # if case is not found then throw an error
            if not case:
                raise HTTPException(status_code = 404, detail = "Case not found, Maybe its already closed")
            
            close = 0
            if case.status == "REQUESTED_BY_USER":
                case.status = "CLOSED"
                close = 1
                asyncio.create_task(
                    create_notification(
                    message = f"Your case with case_id {case.case_id} has been closed by doctor {user_name}", 
                    recipient_id = case.user_id, 
                    recipient_role = "user")
                )
            elif case.status == "OPEN":
                case.status = "REQUESTED_BY_DOCTOR"
                asyncio.create_task(
                    create_notification(
                    message = f"Your case with case_id {case.case_id} has been requested to be closed by doctor {user_name}", 
                    recipient_id = case.user_id, 
                    recipient_role = "user")
                )
            # if case is not in requested by user or open then throw an erro [NOTE  : the close status is already checked when querying the DB.]
            elif case.status not in ["REQUESTED_BY_USER", "OPEN"]:
                raise HTTPException(status_code = 400, detail = "Invalid status")
            
            # deassign the doctor if case got closed
            if close == 1:
                assigned = db.query(AssignedDoctors).filter(AssignedDoctors.user_id == case.user_id, AssignedDoctors.doctor_id == case.doctor_id).first()
                if assigned:
                    db.delete(assigned)
            
            case.last_updated = datetime.now()
            db.commit()
            db.refresh(case)
            
            return {
                "case_id" : case.case_id,
                "status" : case.status,
                "total_cost" : case.cost,
                "note" : "Case closed successfully" if case.status == "CLOSED" else "Case closure requested successfully"
            }
        except Exception as e:
            raise HTTPException(500, str(e))
        finally :
            db.close()
    else : 
        raise HTTPException(status_code = 400, detail = "Invalid user role")

async def remove_symptom_fc(case_id : int, symptom_id : int, user_id : int):
    db = SessionLocal()
    try :
        case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user_id, Cases.status == "OPEN").first()
        if not case:
            raise HTTPException(404, "Case not found")
        
        case.last_updated = datetime.now()
        if case.symptom_ids and symptom_id in case.symptom_ids:
            # case.symptom_ids.remove(symptom_id)
            case.symptom_ids = [i for i in case.symptom_ids if i != symptom_id]
            db.commit()
        
        return {
            "note" : f"Symptom {symptom_id} removed from case"
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally :
        db.close()

async def remove_document_fc(case_id : int, document_id : int, user_id : int, user_name : str, user_role : str):
    db = SessionLocal()
    try :
        case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user_id, Cases.status == "OPEN").first()
        if not case:
            raise HTTPException(404, "Case not found")
        if user_role == "user":
            if case.user_doc_ids and document_id in case.user_doc_ids:
                case.user_doc_ids = [id for id in case.user_doc_ids if id != document_id]
                case.last_updated = datetime.now()
                db.commit()
                asyncio.create_task(
                    create_notification(
                    message = f"user {user_name} has removed document {document_id} from the case {case.case_id}", 
                    recipient_id = case.doctor_id, 
                    recipient_role = user_role)
                )
        elif user_role == "doctor" :
            if case.doctor_doc_ids and document_id in case.doctor_doc_ids:
                case.doctor_doc_ids = [id for id in case.doctor_doc_ids if id != document_id]
                case.last_updated = datetime.now()
                db.commit()
                asyncio.create_task(
                    create_notification(
                    message = f"doctor {user_name} has removed document {document_id} from the case {case.case_id}", 
                    recipient_id = case.user_id, 
                    recipient_role = user_role)
                )
        else :
            raise HTTPException(400, "Invalid user role")
        
        return {
            "note" : f"Document {document_id} removed from case"
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally :
        db.close()

async def case_reopen(case_id : int, user_id : int, user_role : str, user_name : str):
    db = SessionLocal()
    try : 
        case = db.query(Cases).filter(Cases.id == case_id, Cases.user_id == user_id, Cases.status == "CLOSED").first()
        if not case:
            raise HTTPException(status_code = 404, detail = "Case not found or maybe already open")
        case.status = "OPEN"

        # check when was the case last modified
        last_updated = case.last_updated
        doctor = db.query(Doctors).filter(Doctors.id == case.doctor_id, Doctors.is_active == True).first()
        if not doctor:
            raise HTTPException(status_code = 404, detail = "Doctor not found")
        if doctor.availability == False :
            raise HTTPException(status_code = 400, detail = "Doctor is not available")
        # if it was last updated under 6 month ago then take half fees, otherwise it would cost full fees
        days = (datetime.now() - last_updated).days
        if days < 180:
            amount = amount = Decimal(doctor.fees) * Decimal('0.5')
        else:
            amount = Decimal(doctor.fees) 
        
        case.cost += amount

        result = await handle_payment(db, user_id, user_role, case.doctor_id, "doctor", amount, note = f"Reopening case {case.case_id} for doctor {doctor.name}")
        if not result:
            case.cost -= amount
            raise HTTPException(status_code = 400, detail = "Payment failed")
        
        case.last_updated = datetime.now()
        db.commit()
        db.refresh(case)

        asyncio.create_task(
            create_notification(
                message = f"Your case with case_id {case.case_id} has been reopened by user {user_name}", 
                recipient_id = case.doctor_id, 
                recipient_role = "doctor"
            )
        )
        return {
            "note" : "Case reopened successfully",
            "case_id" : case.case_id
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally :
        db.close()

