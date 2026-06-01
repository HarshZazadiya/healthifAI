import os
import asyncio
from typing import Optional
from datetime import datetime
from urllib.parse import urljoin
from database import SessionLocal
from models import Documents, Cases
from fastapi import UploadFile, HTTPException
from utils.document_classifer import check_scannable
from services.notification import create_notification
from utils.signed_url_generator import generate_signed_url

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCUMENTS_DIR = os.path.join(BASE_DIR, "documents")
BASE_URL = os.getenv("BASE_URL")

async def get_document(requester_id : int, requester_role : str, limit : int, offset : int, case_id : Optional[int] = None):
    """
    Get documents with optional filters.    
    """
    db = SessionLocal()
    try :
        cases = db.query(Cases)
        
        if requester_role == "user":
            cases = cases.filter(Cases.user_id == requester_id)
        elif requester_role == "doctor":
            cases = cases.filter(Cases.doctor_id == requester_id)
        elif requester_role == "hospital":
            cases = cases.filter(Cases.hospital_id == requester_id)
        elif requester_role == "admin":
            pass
        else :
            raise HTTPException(status_code = 401, detail = "Unauthorized access")
        
        if case_id is not None :
            cases = cases.filter(Cases.id == case_id)
            
            cases = cases.limit(limit).offset(offset).all()
            data = []
            for case in cases:
                user_document_ids = case.user_doc_ids
                doctor_document_ids = case.doctor_doc_ids
                documents = db.query(Documents).filter(Documents.id.in_(user_document_ids + doctor_document_ids)).all()
                data.append({
                    "case_id" : case.case_id,
                    "documents" : [
                        {
                            "document_id" : document.id,
                            "document_type" : document.type,
                            "document_url" : urljoin(BASE_URL, await generate_signed_url(document.document_path, requester_id, requester_role, document.id, 60))
                        }
                        for document in documents
                    ]
                })
        if not case_id :
            documents = db.query(Documents).filter(Documents.user_id == requester_id, Documents.role == requester_role).all()
            data = [
                {
                    "document_id" : document.id,
                    "document_type" : document.type,
                    "date" : document.date.date(),
                    "time" : document.date.time(),
                    "document_url" : urljoin(BASE_URL, await generate_signed_url(document.document_path, requester_id, requester_role, document.id, 60))
                }
                for document in documents
            ]

        return data
    except Exception as e:
        raise HTTPException(status_code = 500, detail = str(e))
    finally:
        db.close()

async def add_document(uploader_id: int, uploader_role: str, file: UploadFile, doc_type: str, case_id: Optional[int] = None):
    """
    Add a new document to the database.
    """
    db = SessionLocal()
    try :
        unique_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uploader_id}_{uploader_role}_{file.filename}"
        file_path = f"/documents/{unique_filename}"
        
        # Create document record
        document = Documents(
            user_id = uploader_id,
            role = uploader_role,
            type = doc_type,
            document_path = file_path
        )
        db.add(document)
        db.flush()
        
        if case_id is not None:
            # check if they can upload in the case
            case = db.query(Cases).filter(Cases.id == case_id, Cases.status == "OPEN").first()
            if not case:
                db.rollback()
                raise HTTPException(status_code = 404, detail = "Case not found")
            
            if uploader_role == "doctor":
                # check if they can upload
                if case.doctor_id != uploader_id:
                    db.rollback()
                    raise HTTPException(status_code = 400, detail = "You cannot upload documents for this case")
                if case.doctor_doc_ids is None:
                    case.doctor_doc_ids = []
                case.doctor_doc_ids = case.doctor_doc_ids + [document.id]
                recipient_id = case.user_id
                recipient_role = "user"
            elif uploader_role == "user":
                # check if they can upload
                if case.user_id != uploader_id:
                    db.rollback()
                    raise HTTPException(status_code = 400, detail = "You cannot upload documents for this case")
                if case.user_doc_ids is None:
                    case.user_doc_ids = []
                case.user_doc_ids = case.user_doc_ids + [document.id]
                recipient_id = case.doctor_id
                recipient_role = "doctor"
            else:
                db.rollback()
                raise HTTPException(status_code = 400, detail = "You cannot upload documents")
            asyncio.create_task(
                create_notification(f"New document uploaded in case {case.case_id}", recipient_id, recipient_role) 
            )
        
        # Save the actual file
        try:
            path_to_save = os.path.join(DOCUMENTS_DIR, unique_filename)
            with open(path_to_save, "wb") as f:
                content = await file.read()
                f.write(content)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code = 500, detail = f"Failed to save file: {str(e)}")
        
        db.commit()
        db.refresh(document)

        check_scannable(path_to_save)
        
        if case_id:
            db.refresh(case)

        return {
            "id" : document.id,
            "type" : document.type,
            "document_path" : document.document_path,
            "original_filename" : file.filename,
            "case_id" : case_id
        }
    except Exception as e:
        raise HTTPException(status_code = 500, detail = str(e))
    finally:
        db.close()

async def update_policy(requester_id : int, requester_role : str, file : UploadFile):
    """
    Update a document by removing old file and saving new file.
    """
    db = SessionLocal()
    try:
        if requester_role != "hospital":
            raise HTTPException(401, "Unauthorized access to update document")

        document = db.query(Documents).filter(Documents.user_id == requester_id, Documents.role == requester_role, Documents.type == "POLICY").first()
        if not document:
            raise HTTPException(404, "Document not found")
        
        try:
            # Delete old file
            if document.document_path:
                old_path = document.document_path.split("/documents/")[1] if "/documents/" in document.document_path else document.document_path
                path_to_old_file = os.path.join(DOCUMENTS_DIR, old_path)
                if os.path.exists(path_to_old_file):
                    try:
                        os.remove(path_to_old_file)
                    except Exception:
                        pass
            
            # Save new file with unique filename preserving extension
            unique_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{requester_id}_{file.filename}"
            new_path = os.path.join(DOCUMENTS_DIR, unique_filename)
            with open(new_path, "wb") as f:
                content = await file.read()
                f.write(content)
            
            # Update DB
            document.document_path = f"/documents/{unique_filename}"
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(500, f"Failed to save file : {str(e)}")
        
        return {
            "id" : document.id,
            "type" : document.type,
            "document_path" : document.document_path
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()

async def remove_document(doc_id: int, requester_id: int, requester_role: str, requester_name : str, force: bool = False):
    """
    Delete a document by id according to actor's permissions.
    """
    db = SessionLocal()
    try:
        document = db.query(Documents).filter(Documents.id == doc_id).first()
        
        if not document:
            raise HTTPException(404, "Document not found")
        
        if requester_role != "admin":
            if document.user_id != requester_id or document.role != requester_role:
                raise HTTPException(403, "Access denied")
        
        cases_with_doc = db.query(Cases).filter(
            (Cases.user_doc_ids.contains([doc_id])) | 
            (Cases.doctor_doc_ids.contains([doc_id]))
        ).all()
        
        if cases_with_doc and not force:
            raise HTTPException(400, detail = f"Document is attached to {len(cases_with_doc)} case(s).")

        case_affected = []
        for case in cases_with_doc:
            if doc_id in (case.user_doc_ids or []):
                case.user_doc_ids = [i for i in case.user_doc_ids if i != doc_id]
            if doc_id in (case.doctor_doc_ids or []):
                case.doctor_doc_ids = [i for i in case.doctor_doc_ids if i != doc_id]
            case_affected.append(case)
            db.commit()
            db.refresh(case)
        
        # document_path is like http://localhost:8000/documents/<document_name>.pdf
        path = document.document_path.split("documents/")[1]
        path = os.path.join("documents", path)
        if os.path.exists(path):
            os.remove(path)
        
        # Delete document record
        db.delete(document)
        db.commit()
        
        if force is True:
            cases = case_affected
            if len(cases) == 0:
                raise HTTPException(status_code = 404, detail = "Document not found in any case")
            # get doctor id and user id from case id
            for case in cases:
                if requester_role == "user":
                    recipient_id = case.doctor_id
                    recipient_role = "doctor"
                elif requester_role == "doctor":
                    recipient_id = case.user_id
                    recipient_role = "user"
                else :
                    raise HTTPException(status_code = 401, detail = "Unauthorized access")
                asyncio.create_task(
                    create_notification(f"Document deleted in case {case.case_id} by {requester_role} named {requester_name}", recipient_id, recipient_role)
                )

        return {
            "message": "Document permanently deleted and removed from cases",
            "cases_affected": case_affected,
            "document_id": doc_id,
            "removed_from_cases": len(cases_with_doc)
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()

# =========================================================
# POLICIES
# =========================================================

async def get_hospital_policy(user_id : int, user_role : str, hospital_id : Optional[int] = None):
    db = SessionLocal()
    try : 
        base_query = db.query(Documents).filter(Documents.role == "hospital", Documents.type == "POLICY")
        if hospital_id is not None:
            policies = base_query.filter(Documents.user_id == hospital_id).all()
        else :
            policies = base_query.all()
        if not policies:
            raise HTTPException(status_code = 404, detail = "No policies found")
        data = []
        for policy in policies :
            data.append({
                "id" : policy.id,
                "file_name" : policy.document_path.split("/")[-1] if policy.document_path else "Policy Document",
                "url" : urljoin(BASE_URL, await generate_signed_url(policy.document_path, user_id = user_id, user_role = user_role, doc_id = policy.id)),
                "uploaded_at" : policy.date.isoformat() if policy.date else None
            })
        return data
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()

async def get_hospital_policy_for_hospital(hospital_id : int):
    db = SessionLocal()
    try:
        policy = db.query(Documents).filter(Documents.user_id == hospital_id, Documents.role == "hospital", Documents.type == "POLICY").first()
        if not policy:
            raise HTTPException(status_code = 404, detail = "Policy not found, Upload Policy for your hospital")
        policy_location = await generate_signed_url(policy.document_path, hospital_id, "hospital", policy.id, 1200)
        policy_url = urljoin(BASE_URL, policy_location)
        return {
            "uploaded_at" : policy.date.isoformat(),
            "url" : policy_url
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()

async def get_hospital_policy_for_admin(admin_id : int, hospital_id : int = None):
    db = SessionLocal()
    try :
        if hospital_id:
            policy = db.query(Documents).filter(Documents.user_id == hospital_id, Documents.role == "hospital", Documents.type == "POLICY").first()
            return [{
                "id" : policy.id,
                "hospital_id" : policy.user_id,
                "url" : urljoin(BASE_URL, await generate_signed_url(policy.document_path, admin_id, "admin", policy.id)),
                "uploaded_at" : policy.date
            }]
        else : 
            policies = db.query(Documents).filter(Documents.role == "hospital", Documents.type == "POLICY").all()
            data = []
            for policy in policies:
                data.append({
                    "id" : policy.id,
                    "hospital_id" : policy.user_id,
                    "url" : urljoin(BASE_URL, await generate_signed_url(policy.document_path, admin_id, "admin", policy.id)),
                    "uploaded_at" : policy.date
                })

            return data
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()
