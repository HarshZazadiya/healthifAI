import os
from fastapi.responses import FileResponse
from jose import jwt, JWTError
from pydantic import BaseModel
from fastapi import BackgroundTasks
from typing import Annotated, List, Optional
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from models import Cases, Doctors, AssignedDoctors
from services.payment import handle_payment
from services.profile import change_password
from services.wallet import my_wallet, top_up
from services.notifcation import create_notification, delete_all_notification, delete_notifications, my_notfications, mark_notifications_as_read
from services.document_handling import add_document, remove_document, get_document
from utils.redis_config import redis_client
from utils.dependencies import requester_dependency, db_dependency
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from utils.signed_url_generator import verify_signed_url
from logs.logging import logger

router = APIRouter(
    prefix = "/default", 
    tags = ["default"]
)

# =====================================================================================
# CONFIG
# =====================================================================================

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")

SECRET_SIGN_KEY_FOR_URL = os.getenv("SECRET_SIGN_KEY_FOR_URL", "your-super-secret-key-change-in-production")
serializer = URLSafeTimedSerializer(SECRET_SIGN_KEY_FOR_URL)

oauth2_bearer = OAuth2PasswordBearer(tokenUrl = "/auth/token")
bcrypt_context = CryptContext(schemes = ["bcrypt"], deprecated = "auto")

# =====================================================================================
# PYDANTIC MODELS
# =====================================================================================

class PaymentRequest(BaseModel):
    amount : int

class PasswordRequest(BaseModel):
    password : str

class NotificationSendRequest(BaseModel):
    message : str
    recipient_role : str
    recipient_ids : Optional[list[int]] = None
    send_to_all : Optional[bool] = False

class NotificationsRequest(BaseModel):
    message : str

class DocumentUploadRequest(BaseModel):
    document : UploadFile = File(...),
    type : str
    
class DocumentIDsRequest(BaseModel):
    documents : List[DocumentUploadRequest]


# =====================================================================================
# PROFILE
# =====================================================================================

@router.put("/password", status_code = 200)
async def password(request : PasswordRequest, requester : requester_dependency, db : db_dependency):
    result = await change_password(request, requester, db)
    return result

# =====================================================================================
# WALLET
# =====================================================================================

@router.put("/topUp")
async def top_up_wallet(db : db_dependency, payment_request : PaymentRequest, token : Annotated[str, Depends(oauth2_bearer)]):
    """Add money to wallet"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms = [ALGORITHM])
        owner_type = payload.get("type")
        owner_id   = payload.get("id")
        owner_role = payload.get("role")
    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid token")

    result = await top_up(db, payment_request.amount, owner_id, owner_role, owner_type)

    if result.get("message") == "Wallet topped up successfully":
        handle_payment(
            db, 
            owner_id, 
            owner_role, 
            owner_id, 
            owner_role, 
            payment_request.amount, 
            note = "TOP-UP", type = "INCOMING"
        )
    if redis_client:
        try:
            await redis_client.delete(f"wallet : {owner_type} : {owner_id}")
            logger.info(f"✅ Redis cache cleared for {owner_type} : {owner_id}")
        except Exception as e:
            logger.info(f"⚠️ Redis cache clear failed (non-critical) : {e}")

    return result

@router.get("/myWallet")
async def get_my_wallet(db : db_dependency, token : Annotated[str, Depends(oauth2_bearer)]):
    """Get current wallet balance"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms = [ALGORITHM])
        owner_type = payload.get("type")
        owner_id   = payload.get("id")
        owner_role = payload.get("role")
    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid token")

    # check in redis for info 
    if redis_client:
        try:
            balance = await redis_client.get(f"wallet : {owner_type} : {owner_id}")
            if balance:
                return {"balance" : float(balance)}
        except Exception as e:
            logger.info(f"⚠️ Redis cache get failed (non-critical) : {e}")

    result = await my_wallet(db, owner_id, owner_role)

    if redis_client:
        try:
            await redis_client.set(f"wallet : {owner_type} : {owner_id}", result["balance"])
            logger.info(f"✅ Redis cache set for {owner_type} : {owner_id}")
        except Exception as e:
            logger.info(f"⚠️ Redis cache set failed (non-critical) : {e}")
            
    return result

# =====================================================================================
# DOCUMENTS
# =====================================================================================

@router.get("/documents", status_code = 200)
async def get_documents(requester : requester_dependency, db : db_dependency, limit : int = 20, offset : int = 0, case_id : Optional[int] = None):
    result =  await get_document(db, requester["id"], requester["role"], limit, offset, case_id)
    return result

@router.post("/documents", status_code = 200)
async def upload_document(requester : requester_dependency, db : db_dependency, type : str, case_id : Optional[int] = None, document : UploadFile = File(...)):
    if requester["role"] == "hospital" or requester["role"] == "admin":
        raise HTTPException(status_code = 400, detail = "You cannot upload document in the case")
    # add document to the database
    result = await add_document(db, requester["id"], requester["role"], document, type.upper(), case_id)
    # send notification to the other party in the case if case_id is provided
    if case_id is not None:
        case = db.query(Cases).filter(Cases.case_id == case_id).first()
        if not case:
            raise HTTPException(status_code = 404, detail = "Case not found")
        if requester["role"] == "user":
            recipient_id = case.doctor_id
            recipient_role = "doctor"
        elif requester["role"] == "doctor":
            recipient_id = case.user_id
            recipient_role = "user"
        else :
            raise HTTPException(status_code = 401, detail = "Unauthorized access")
        
        await create_notification(db, f"New document uploaded in case {case.case_id}", recipient_id, recipient_role)    
    return result

@router.delete("/documents/{doc_id}", status_code = 200)
async def delete_document(doc_id : int, requester : requester_dependency, db : db_dependency, force : bool = False, background_tasks: BackgroundTasks = BackgroundTasks() ):
    if requester["role"] == "hospital" or requester["role"] == "admin":
        raise HTTPException(status_code = 400, detail = "You cannot delete document in the case")
    result = await remove_document(db, doc_id, requester["id"], requester["role"], force)
    # send notification to the other party in the case if force is true
    if force is True:
        cases = result.get("cases_affected")
        if len(cases) == 0:
            raise HTTPException(status_code = 404, detail = "Document not found in any case")
        # get doctor id and user id from case id
        for case in cases:
            if requester["role"] == "user":
                recipient_id = case.doctor_id
                recipient_role = "doctor"
            elif requester["role"] == "doctor":
                recipient_id = case.user_id
                recipient_role = "user"
            else :
                raise HTTPException(status_code = 401, detail = "Unauthorized access")
            background_tasks.add_task(
                create_notification, 
                f"Document deleted in case {case.case_id} by {requester['role']} named {requester['name']}", 
                recipient_id, 
                recipient_role
            )

    return result

@router.get("/view", status_code=200)
async def view_file(
    token: str = Query(..., description = "Signed URL token")
):
    try:
        # Decode and verify the token
        payload = serializer.loads(token)
        result = await verify_signed_url(token)
        if result == False:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get file info
        url_file_path = payload["file_path"]
        original_filename = payload.get("original_filename", "document")
        logger.info(f"Original filename: {original_filename}")
        
        # Convert URL path to filesystem path
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        DOCUMENTS_DIR = os.path.join(BASE_DIR, "documents")
        actual_file_path = os.path.join(DOCUMENTS_DIR, os.path.basename(url_file_path))
        
        # Check if file exists
        if not os.path.exists(actual_file_path):
            raise HTTPException(status_code = 404, detail = f"File not found")
        
        # Get actual file extension
        actual_filename = os.path.basename(actual_file_path)
        ext = actual_filename.rsplit('.', 1)[-1].lower() if '.' in actual_filename else 'bin'
        
        # Build display filename
        if not original_filename:
            display_filename = actual_filename
        elif '.' in original_filename:
            display_filename = original_filename
        else:
            display_filename = f"{original_filename}.{ext}"
        
        logger.info(f"Display filename: {display_filename}")
        
        # MIME types
        mime_types = {
            'pdf' : 'application/pdf',
            'jpg' : 'image/jpeg',
            'jpeg' : 'image/jpeg',
            'png' : 'image/png',
            'gif' : 'image/gif',
            'webp' : 'image/webp',
            'svg' : 'image/svg+xml',
            'txt' : 'text/plain',
            'doc' : 'application/msword',
            'docx' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }
        
        media_type = mime_types.get(ext, 'application/octet-stream')
        
        return FileResponse(
            path = actual_file_path,
            media_type = media_type
        )
        
    except SignatureExpired:
        raise HTTPException(status_code=410, detail="Download link has expired")
    except BadSignature:
        raise HTTPException(status_code=400, detail="Invalid download link")
    except HTTPException:
        raise
    except Exception as e:
        logger.info(f"Download error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
# =====================================================================================
# NOTIFICATIONS
# =====================================================================================

@router.get("/notifications/", status_code = 200)
async def get_notifications(requester : requester_dependency, db : db_dependency):
    notifications = await my_notfications(db, requester["id"], requester["role"])
    return {"notifications" : notifications, "count" : len(notifications)}

@router.put("/notification/", status_code = 200)
async def mark_notification_as_read(requester : requester_dependency, db : db_dependency, notification_id : Optional[int] = Query(None, description = "Filter by notification id")):
    if notification_id :
        # mark one as read
        result = await mark_notifications_as_read(db, requester["id"], requester["role"], notification_id = notification_id)
    else :
        # mark all as read
        result = await mark_notifications_as_read(db, requester["id"], requester["role"])
    
    if result is None:
        raise HTTPException(status_code = 404, detail = "Notification not found")
    return result
    
@router.delete("/notification/{notification_id}", status_code = 200)
async def delete_notification(requester : requester_dependency, db : db_dependency, notification_id : Optional[int]) :
    if notification_id :
        result = await delete_notifications(db, notification_id, requester["id"], requester["role"])
        if result is None:
            raise HTTPException(status_code = 404, detail = "Notification not found")
        return result
    else :
        result = await delete_all_notification(db, requester["id"], requester["role"])
        if result is None:
            raise HTTPException(status_code = 404, detail = "Notification not found")
        return result