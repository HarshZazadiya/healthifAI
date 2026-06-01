import os
import base64
from io import BytesIO
from datetime import datetime
from pydantic import BaseModel
from jose import jwt, JWTError
from logs.logging import logger
from database import SessionLocal
from sqlalchemy.orm import Session
from typing import Annotated, Dict, Optional, Union, Any
from urllib.parse import urljoin
from fastapi.responses import FileResponse
from utils.dependencies import db_dependency
from services.document_handling import add_document
from utils.signed_url_generator import generate_signed_url
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from models import Cases, Users, Doctors, ConversationRoom, ConversationMessage, AssignedDoctors, Hospitals, DoctorHospitalConversationRoom, DoctorHospitalConversationMessage, DoctorDoctorConversationRoom, DoctorDoctorConversationMessage

router = APIRouter(
    prefix="/chat",
    tags=["chat"]
)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
UPLOAD_DIR = os.getenv("UPLOAD_DIR")
BASE_URL = os.getenv("BASE_URL")

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ============================================
# PYDANTIC MODELS
# ============================================

class MessageCreate(BaseModel):
    room_id: Optional[int] = None
    doctor_id: Optional[int] = None
    message: str
    message_type: str = "text"
    file_data: Optional[str] = None
    file_name: Optional[str] = None

class RoomResponse(BaseModel):
    id: int
    user_id: int
    doctor_id: int
    user_name: str
    doctor_name: str
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    unread_count: int
    is_active: bool

# ============================================
# CONNECTION MANAGER
# ============================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_rooms: Dict[str, Union[int, Dict[str, Any]]] = {}

    async def connect(self, websocket: WebSocket, user_id: int, user_type: str):
        await websocket.accept()
        key = f"{user_type}_{user_id}"
        self.active_connections[key] = websocket

    def disconnect(self, user_id: int, user_type: str):
        key = f"{user_type}_{user_id}"
        if key in self.active_connections:
            del self.active_connections[key]
        if key in self.user_rooms:
            del self.user_rooms[key]

    async def send_personal_message(self, message: dict, user_id: int, user_type: str):
        key = f"{user_type}_{user_id}"
        if key in self.active_connections:
            try:
                await self.active_connections[key].send_json(message)
                return True
            except:
                return False
        return False

    async def broadcast_to_room(self, message: dict, room_id: int, chat_type: Optional[str] = None, exclude_key: Optional[str] = None):
        for key, ws in self.active_connections.items():
            if key != exclude_key:
                room_info = self.user_rooms.get(key)
                if room_info:
                    if isinstance(room_info, dict):
                        target_room_id = room_info.get("room_id")
                        target_chat_type = room_info.get("chat_type")
                        if target_room_id == room_id and (chat_type is None or target_chat_type is None or target_chat_type == chat_type):
                            try:
                                await ws.send_json(message)
                            except:
                                pass
                    elif room_info == room_id:
                        try:
                            await ws.send_json(message)
                        except:
                            pass

    def is_user_online(self, user_id: int, user_type: str) -> bool:
        key = f"{user_type}_{user_id}"
        return key in self.active_connections

manager = ConnectionManager()

class Base64UploadFile:
    """Mimics FastAPI UploadFile for base64-encoded file data."""
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content
        self._position = 0

    async def read(self, size: int = -1) -> bytes:
        if size == -1:
            data = self.content[self._position:]
            self._position = len(self.content)
            return data
        else:
            data = self.content[self._position:self._position + size]
            self._position += len(data)
            return data

    async def seek(self, offset: int) -> None:
        self._position = offset

    async def close(self) -> None:
        pass

# ============================================
# AUTHENTICATION
# ============================================

async def get_token_from_websocket(websocket: WebSocket) -> dict:
    """Extract and validate token from WebSocket query parameters"""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return None
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        await websocket.close(code=4002, reason="Invalid authentication token")
        return None

# ============================================
# WEBSOCKET ENDPOINT
# ============================================

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Authenticate
    payload = await get_token_from_websocket(websocket)
    if not payload:
        return
    
    user_id = payload.get("id")
    user_type = payload.get("type")
    user_role = payload.get("role")
    
    if user_type.lower() not in ["user", "doctor", "hospital", "admin"]:
        await websocket.close(code=4003, reason="Invalid user type")
        return
    
    await manager.connect(websocket, user_id, user_type)
    
    # Get database session
    db = SessionLocal()
    
    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connection",
            "status": "connected",
            "user_id": user_id,
            "user_type": user_type,
            "message": "Connected to chat server"
        })
        
        while True:
            # Receive message
            data = await websocket.receive_json()
            
            message_type = data.get("type", "message")
            
            if message_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            
            elif message_type == "message":
                await handle_chat_message(data, user_id, user_type, db)
            
            elif message_type == "typing":
                await handle_typing_indicator(data, user_id, user_type)
            
            elif message_type == "read_receipt":
                await handle_read_receipt(data, user_id, user_type, db)
            
            elif message_type == "join_room":
                room_id = data.get("room_id")
                chat_type = data.get("chat_type")
                if room_id:
                    key = f"{user_type}_{user_id}"
                    manager.user_rooms[key] = {"room_id": room_id, "chat_type": chat_type}
            
            elif message_type == "leave_room":
                key = f"{user_type}_{user_id}"
                if key in manager.user_rooms:
                    del manager.user_rooms[key]
    
    except WebSocketDisconnect:
        manager.disconnect(user_id, user_type)
        await notify_user_status(user_id, user_type, False, db)
    except Exception as e:
        logger.info(f"WebSocket error: {e}")
        manager.disconnect(user_id, user_type)
    finally:
        db.close()

async def handle_chat_message(data: dict, sender_id: int, sender_type: str, db: Session):
    """Handle incoming chat messages"""
    room_id = data.get("room_id")
    chat_type = data.get("chat_type")
    message_text = data.get("message", "")
    file_data = data.get("file_data")
    file_name = data.get("file_name")
    file_type = data.get("file_type", "image")
    
    if not room_id:
        return
    
    # Determine if it's doctor-hospital chat, doctor-doctor chat, or user-doctor chat
    is_doc_hosp = False
    is_doc_doc = False
    if chat_type == "doctor_hospital":
        is_doc_hosp = True
    elif chat_type == "doctor_doctor":
        is_doc_doc = True
    elif chat_type == "user_doctor":
        is_doc_hosp = False
    elif sender_type == "hospital":
        is_doc_hosp = True
    elif sender_type == "user":
        is_doc_hosp = False
    else:
        # sender_type is "doctor", but no chat_type is specified.
        # Check if the room exists in DoctorHospitalConversationRoom and doctor is part of it
        room_h = db.query(DoctorHospitalConversationRoom).filter(
            DoctorHospitalConversationRoom.id == room_id,
            DoctorHospitalConversationRoom.doctor_id == sender_id
        ).first()
        if room_h:
            is_doc_hosp = True
        else:
            room_d = db.query(DoctorDoctorConversationRoom).filter(
                DoctorDoctorConversationRoom.id == room_id,
                (DoctorDoctorConversationRoom.doctor1_id == sender_id) | (DoctorDoctorConversationRoom.doctor2_id == sender_id)
            ).first()
            if room_d:
                is_doc_doc = True

    # Now load the correct room
    if is_doc_hosp:
        room = db.query(DoctorHospitalConversationRoom).filter(DoctorHospitalConversationRoom.id == room_id).first()
    elif is_doc_doc:
        room = db.query(DoctorDoctorConversationRoom).filter(DoctorDoctorConversationRoom.id == room_id).first()
    else:
        room = db.query(ConversationRoom).filter(ConversationRoom.id == room_id).first()
 
    if not room:
        return
    
    if is_doc_hosp:
        if sender_type == "doctor" and room.doctor_id != sender_id:
            return
        if sender_type == "hospital" and room.hospital_id != sender_id:
            return
    elif is_doc_doc:
        if sender_type != "doctor" or (room.doctor1_id != sender_id and room.doctor2_id != sender_id):
            return
    else:
        if sender_type == "user" and room.user_id != sender_id:
            return
        if sender_type == "doctor" and room.doctor_id != sender_id:
            return
    
    # Handle file upload
    attachment_url = None
    if file_data and file_name:
        saved_path = await save_file(
            file_data = file_data,
            file_name = file_name,
            room_id = room_id,
            sender_id = sender_id,
            sender_type = sender_type,
            doc_type = file_type,
            is_doc_hosp = is_doc_hosp,
            chat_type = chat_type
        )
        if saved_path:
            # Generate signed URL for immediate use in WebSocket response
            signed_url = await generate_signed_url(
                file_path = saved_path,
                user_id = sender_id,
                user_role = sender_type,
                doc_id = 0,
                directory = "documents",
                expiration_seconds = 86400
            )
            attachment_url = urljoin(BASE_URL, signed_url)
        else:
            attachment_url = None
 
    # Create Message
    if is_doc_hosp:
        new_message = DoctorHospitalConversationMessage(
            room_id = room_id,
            sender_id = sender_id,
            sender_type = sender_type,
            content = message_text,
            message_type = data.get("message_type", "file") if file_data else "text",
            attachment_url = saved_path if file_data else None,
            is_read = False
        )
    elif is_doc_doc:
        new_message = DoctorDoctorConversationMessage(
            room_id = room_id,
            sender_id = sender_id,
            content = message_text,
            message_type = data.get("message_type", "file") if file_data else "text",
            attachment_url = saved_path if file_data else None,
            is_read = False
        )
    else:
        new_message = ConversationMessage(
            room_id = room_id,
            sender_id = sender_id,
            sender_type = sender_type,
            content = message_text,
            message_type = data.get("message_type", "file") if file_data else "text",
            attachment_url = saved_path if file_data else None,
            is_read = False
        )
    db.add(new_message)
    room.updated_at = datetime.now()
    db.commit()
    db.refresh(new_message)
    
    # Get sender name
    if sender_type == "user":
        sender = db.query(Users).filter(Users.id == sender_id).first()
        sender_name = sender.name if sender else "User"
    elif sender_type == "doctor":
        sender = db.query(Doctors).filter(Doctors.id == sender_id).first()
        sender_name = sender.name if sender else "Doctor"
    elif sender_type == "hospital":
        sender = db.query(Hospitals).filter(Hospitals.id == sender_id).first()
        sender_name = sender.name if sender else "Hospital"
    else:
        sender_name = "System"
    
    # Prepare message for sending
    message_response = {
        "type" : "message",
        "id" : new_message.id,
        "room_id" : room_id,
        "chat_type" : chat_type or ("doctor_hospital" if is_doc_hosp else "doctor_doctor" if is_doc_doc else "user_doctor"),
        "sender_id" : sender_id,
        "sender_type" : sender_type,
        "sender_name" : sender_name,
        "message" : message_text,
        "message_type" : new_message.message_type,
        "file_url" : attachment_url,                     
        "created_at" : new_message.created_at.isoformat() if new_message.created_at else None,
        "is_read" : False
    }
    
    # Send to recipient
    if is_doc_hosp:
        if sender_type == "doctor":
            await manager.send_personal_message(message_response, room.hospital_id, "hospital")
            await manager.send_personal_message({**message_response, "status": "sent"}, sender_id, "doctor")
        else:
            await manager.send_personal_message(message_response, room.doctor_id, "doctor")
            await manager.send_personal_message({**message_response, "status": "sent"}, sender_id, "hospital")
    elif is_doc_doc:
        other_doctor_id = room.doctor2_id if room.doctor1_id == sender_id else room.doctor1_id
        await manager.send_personal_message(message_response, other_doctor_id, "doctor")
        await manager.send_personal_message({**message_response, "status": "sent"}, sender_id, "doctor")
    else:
        if sender_type == "user":
            await manager.send_personal_message(message_response, room.doctor_id, "doctor")
            await manager.send_personal_message({**message_response, "status": "sent"}, sender_id, "user")
        else:
            await manager.send_personal_message(message_response, room.user_id, "user")
            await manager.send_personal_message({**message_response, "status": "sent"}, sender_id, "doctor")

async def handle_typing_indicator(data: dict, sender_id: int, sender_type: str):
    """Handle typing indicators"""
    room_id = data.get("room_id")
    chat_type = data.get("chat_type")
    is_typing = data.get("is_typing", False)
    
    if not room_id:
        return
    
    key = f"{sender_type}_{sender_id}"
    
    typing_message = {
        "type": "typing",
        "room_id": room_id,
        "chat_type": chat_type,
        "sender_id": sender_id,
        "sender_type": sender_type,
        "is_typing": is_typing
    }
    
    await manager.broadcast_to_room(typing_message, room_id, chat_type=chat_type, exclude_key=key)

async def handle_read_receipt(data: dict, user_id: int, user_type: str, db: Session):
    """Mark messages as read"""
    message_ids = data.get("message_ids", [])
    room_id = data.get("room_id")
    chat_type = data.get("chat_type")
    
    if message_ids:
        # Determine the table to update
        if chat_type == "doctor_hospital" or user_type == "hospital":
            db.query(DoctorHospitalConversationMessage).filter(
                DoctorHospitalConversationMessage.id.in_(message_ids)
            ).update({"is_read": True}, synchronize_session=False)
        elif chat_type == "user_doctor" or user_type == "user":
            db.query(ConversationMessage).filter(
                ConversationMessage.id.in_(message_ids)
            ).update({"is_read": True}, synchronize_session=False)
        else:
            # Fallback: update both
            db.query(ConversationMessage).filter(
                ConversationMessage.id.in_(message_ids)
            ).update({"is_read": True}, synchronize_session=False)
            db.query(DoctorHospitalConversationMessage).filter(
                DoctorHospitalConversationMessage.id.in_(message_ids)
            ).update({"is_read": True}, synchronize_session=False)
        db.commit()
    
    read_receipt = {
        "type": "read_receipt",
        "message_ids": message_ids,
        "room_id": room_id,
        "chat_type": chat_type,
        "read_by": user_id,
        "read_by_type": user_type
    }
    
    await manager.broadcast_to_room(read_receipt, room_id, chat_type=chat_type)

async def notify_user_status(user_id: int, user_type: str, is_online: bool, db: Session):
    """Notify relevant users about status change"""
    status_message = {
        "type": "user_status",
        "user_id": user_id,
        "user_type": user_type,
        "is_online": is_online
    }
    
    if user_type == "user":
        rooms = db.query(ConversationRoom).filter(ConversationRoom.user_id == user_id).all()
        for room in rooms:
            status_message["room_id"] = room.id
            await manager.send_personal_message(status_message, room.doctor_id, "doctor")
    elif user_type == "doctor":
        rooms = db.query(ConversationRoom).filter(ConversationRoom.doctor_id == user_id).all()
        for room in rooms:
            status_message["room_id"] = room.id
            await manager.send_personal_message(status_message, room.user_id, "user")
        h_rooms = db.query(DoctorHospitalConversationRoom).filter(DoctorHospitalConversationRoom.doctor_id == user_id).all()
        for room in h_rooms:
            status_message["room_id"] = room.id
            await manager.send_personal_message(status_message, room.hospital_id, "hospital")
    elif user_type == "hospital":
        h_rooms = db.query(DoctorHospitalConversationRoom).filter(DoctorHospitalConversationRoom.hospital_id == user_id).all()
        for room in h_rooms:
            status_message["room_id"] = room.id
            await manager.send_personal_message(status_message, room.doctor_id, "doctor")

async def save_file(file_data: str, file_name: str, room_id: int, sender_id: int, sender_type: str, doc_type: str, is_doc_hosp: bool = False, chat_type: Optional[str] = None) -> str:
    """Save base64 encoded file and return the stored document path."""
    from models import Documents as DB_Documents
    db = SessionLocal()
    try:
        # 1. Decode base64 to bytes
        if "base64," in file_data:
            file_data = file_data.split("base64,")[1]
        file_bytes = base64.b64decode(file_data)

        # 2. Get the room
        if is_doc_hosp:
            room = db.query(DoctorHospitalConversationRoom).filter(DoctorHospitalConversationRoom.id == room_id).first()
        elif chat_type == "doctor_doctor":
            room = db.query(DoctorDoctorConversationRoom).filter(DoctorDoctorConversationRoom.id == room_id).first()
        else:
            room = db.query(ConversationRoom).filter(ConversationRoom.id == room_id).first()
            
        if not room:
            return None

        if is_doc_hosp or chat_type == "doctor_doctor":
            # Just save to disk and add to Documents model without a case
            unique_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{sender_id}_{file_name}"
            dest_path = os.path.join(UPLOAD_DIR, unique_filename)
            with open(dest_path, "wb") as f:
                f.write(file_bytes)
            
            relative_path = f"/documents/{unique_filename}"
            db_doc = DB_Documents(
                user_id = sender_id,
                role = sender_type,
                document_path = relative_path,
                type = doc_type.upper()
            )
            db.add(db_doc)
            db.commit()
            return relative_path

        # 3. Create an UploadFile-like wrapper
        upload_file = Base64UploadFile(filename=file_name, content=file_bytes)

        # 4. Get the case associated with this chat room
        case = db.query(Cases).filter(Cases.user_id == room.user_id, Cases.doctor_id == room.doctor_id, Cases.status == "OPEN").first()
        if not case:
            return None

        # 5. Call add_document (saves file to /documents and links to case)
        result = await add_document(
            db=db,
            uploader_id = sender_id,
            uploader_role = sender_type,
            file = upload_file,
            doc_type = doc_type.upper(),
            case_id = case.id
        )
        response_path = result["document_path"]
        return response_path   # e.g. "/documents/20250305_143022_42_report.pdf"

    except Exception as e:
        logger.error(f"Error saving file: {e}")
        return None
    finally:
        db.close()

# ============================================
# REST ENDPOINTS
# ============================================

@router.get("/rooms", status_code=200)
async def get_conversation_rooms(
    db: db_dependency,
    token: str = Query(...)
):
    """Get all conversation rooms for the authenticated user"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
        user_type = payload.get("type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    rooms = []
    
    if user_type == "user":
        db_rooms = db.query(ConversationRoom).filter(
            ConversationRoom.user_id == user_id,
            ConversationRoom.is_active == True
        ).all()
        
        for room in db_rooms:
            doctor = db.query(Doctors).filter(Doctors.id == room.doctor_id).first()
            
            last_message = db.query(ConversationMessage).filter(
                ConversationMessage.room_id == room.id
            ).order_by(ConversationMessage.created_at.desc()).first()
            
            unread_count = db.query(ConversationMessage).filter(
                ConversationMessage.room_id == room.id,
                ConversationMessage.sender_type == "doctor",
                ConversationMessage.is_read == False
            ).count()
            
            rooms.append({
                "id": room.id,
                "chat_type": "user_doctor",
                "user_id": room.user_id,
                "doctor_id": room.doctor_id,
                "doctor_name": doctor.name if doctor else "Unknown",
                "doctor_speciality": doctor.speciality if doctor else None,
                "last_message": last_message.content if last_message else None,
                "last_message_time": last_message.created_at.isoformat() if last_message else None,
                "unread_count": unread_count,
                "is_doctor_online": manager.is_user_online(room.doctor_id, "doctor"),
                "updated_at": room.updated_at.isoformat() if room.updated_at else None
            })
    
    elif user_type == "doctor":
        # 1. Patient rooms
        db_rooms = db.query(ConversationRoom).filter(
            ConversationRoom.doctor_id == user_id,
            ConversationRoom.is_active == True
        ).all()
        
        for room in db_rooms:
            user = db.query(Users).filter(Users.id == room.user_id).first()
            
            last_message = db.query(ConversationMessage).filter(
                ConversationMessage.room_id == room.id
            ).order_by(ConversationMessage.created_at.desc()).first()
            
            unread_count = db.query(ConversationMessage).filter(
                ConversationMessage.room_id == room.id,
                ConversationMessage.sender_type == "user",
                ConversationMessage.is_read == False
            ).count()
            
            rooms.append({
                "id": room.id,
                "chat_type": "user_doctor",
                "user_id": room.user_id,
                "doctor_id": room.doctor_id,
                "user_name": user.name if user else "Unknown",
                "last_message": last_message.content if last_message else None,
                "last_message_time": last_message.created_at.isoformat() if last_message else None,
                "unread_count": unread_count,
                "is_user_online": manager.is_user_online(room.user_id, "user"),
                "updated_at": room.updated_at.isoformat() if room.updated_at else None
            })

        # 2. Hospital rooms
        db_h_rooms = db.query(DoctorHospitalConversationRoom).filter(
            DoctorHospitalConversationRoom.doctor_id == user_id,
            DoctorHospitalConversationRoom.is_active == True
        ).all()
        
        for room in db_h_rooms:
            hosp = db.query(Hospitals).filter(Hospitals.id == room.hospital_id).first()
            
            last_message = db.query(DoctorHospitalConversationMessage).filter(
                DoctorHospitalConversationMessage.room_id == room.id
            ).order_by(DoctorHospitalConversationMessage.created_at.desc()).first()
            
            unread_count = db.query(DoctorHospitalConversationMessage).filter(
                DoctorHospitalConversationMessage.room_id == room.id,
                DoctorHospitalConversationMessage.sender_type == "hospital",
                DoctorHospitalConversationMessage.is_read == False
            ).count()
            
            rooms.append({
                "id": room.id,
                "chat_type": "doctor_hospital",
                "hospital_id": room.hospital_id,
                "doctor_id": room.doctor_id,
                "hospital_name": hosp.name if hosp else "Unknown",
                "last_message": last_message.content if last_message else None,
                "last_message_time": last_message.created_at.isoformat() if last_message else None,
                "unread_count": unread_count,
                "is_hospital_online": manager.is_user_online(room.hospital_id, "hospital"),
                "updated_at": room.updated_at.isoformat() if room.updated_at else None
            })

        # 3. Doctor-Doctor rooms
        db_d_rooms = db.query(DoctorDoctorConversationRoom).filter(
            ((DoctorDoctorConversationRoom.doctor1_id == user_id) | (DoctorDoctorConversationRoom.doctor2_id == user_id)),
            DoctorDoctorConversationRoom.is_active == True
        ).all()
        
        for room in db_d_rooms:
            other_doc_id = room.doctor2_id if room.doctor1_id == user_id else room.doctor1_id
            other_doc = db.query(Doctors).filter(Doctors.id == other_doc_id).first()
            
            last_message = db.query(DoctorDoctorConversationMessage).filter(
                DoctorDoctorConversationMessage.room_id == room.id
            ).order_by(DoctorDoctorConversationMessage.created_at.desc()).first()
            
            unread_count = db.query(DoctorDoctorConversationMessage).filter(
                DoctorDoctorConversationMessage.room_id == room.id,
                DoctorDoctorConversationMessage.sender_id != user_id,
                DoctorDoctorConversationMessage.is_read == False
            ).count()
            
            rooms.append({
                "id": room.id,
                "chat_type": "doctor_doctor",
                "doctor1_id": room.doctor1_id,
                "doctor2_id": room.doctor2_id,
                "other_doctor_id": other_doc_id,
                "other_doctor_name": other_doc.name if other_doc else "Unknown",
                "other_doctor_speciality": other_doc.speciality if other_doc else None,
                "last_message": last_message.content if last_message else None,
                "last_message_time": last_message.created_at.isoformat() if last_message else None,
                "unread_count": unread_count,
                "is_other_doctor_online": manager.is_user_online(other_doc_id, "doctor"),
                "updated_at": room.updated_at.isoformat() if room.updated_at else None
            })

    elif user_type == "hospital":
        # Hospital rooms with doctors
        db_h_rooms = db.query(DoctorHospitalConversationRoom).filter(
            DoctorHospitalConversationRoom.hospital_id == user_id,
            DoctorHospitalConversationRoom.is_active == True
        ).all()
        
        for room in db_h_rooms:
            doc = db.query(Doctors).filter(Doctors.id == room.doctor_id).first()
            
            last_message = db.query(DoctorHospitalConversationMessage).filter(
                DoctorHospitalConversationMessage.room_id == room.id
            ).order_by(DoctorHospitalConversationMessage.created_at.desc()).first()
            
            unread_count = db.query(DoctorHospitalConversationMessage).filter(
                DoctorHospitalConversationMessage.room_id == room.id,
                DoctorHospitalConversationMessage.sender_type == "doctor",
                DoctorHospitalConversationMessage.is_read == False
            ).count()
            
            rooms.append({
                "id": room.id,
                "chat_type": "doctor_hospital",
                "hospital_id": room.hospital_id,
                "doctor_id": room.doctor_id,
                "doctor_name": doc.name if doc else "Unknown",
                "doctor_speciality": doc.speciality if doc else None,
                "last_message": last_message.content if last_message else None,
                "last_message_time": last_message.created_at.isoformat() if last_message else None,
                "unread_count": unread_count,
                "is_doctor_online": manager.is_user_online(room.doctor_id, "doctor"),
                "updated_at": room.updated_at.isoformat() if room.updated_at else None
            })
    
    return {"rooms": rooms, "total": len(rooms)}


@router.post("/room", status_code=201)
async def create_or_get_room(
    db: db_dependency,
    token: str = Query(...),
    doctor_id: Optional[int] = Query(None),
    patient_id: Optional[int] = Query(None)
):
    """Create or get existing conversation room between user and doctor"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_id = payload.get("id")
        user_type = payload.get("type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    if user_type == "user":
        # Patient is initiating chat with a doctor
        p_id = token_id
        d_id = doctor_id
        if not d_id:
            raise HTTPException(status_code=400, detail="doctor_id is required")
    elif user_type == "doctor":
        # Doctor is initiating chat with a patient
        d_id = token_id
        p_id = patient_id
        if not p_id:
            raise HTTPException(status_code=400, detail="patient_id is required")
    else:
        raise HTTPException(status_code=403, detail="Only patients and doctors can initiate chat")
    
    # Verify patient exists
    patient = db.query(Users).filter(Users.id == p_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # Verify doctor exists
    doctor = db.query(Doctors).filter(Doctors.id == d_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    existing_room = db.query(ConversationRoom).filter(
        ConversationRoom.user_id == p_id,
        ConversationRoom.doctor_id == d_id
    ).first()
    
    if existing_room:
        if not existing_room.is_active:
            existing_room.is_active = True
            db.commit()
        return {"room_id": existing_room.id, "is_new": False}
    
    new_room = ConversationRoom(
        user_id=p_id,
        doctor_id=d_id,
        is_active=True
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    
    return {"room_id": new_room.id, "is_new": True}


@router.post("/room/hospital", status_code=201)
async def create_or_get_doctor_hospital_room(
    db: db_dependency,
    doctor_id: Optional[int] = Query(None),
    token: str = Query(...)
):
    """Create or get existing conversation room between doctor and hospital"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
        user_type = payload.get("type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    if user_type == "doctor":
        # A doctor can only chat with their assigned hospital
        doc = db.query(Doctors).filter(Doctors.id == user_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Doctor not found")
        hosp_id = doc.hospital_id
    elif user_type == "hospital":
        if not doctor_id:
            raise HTTPException(status_code=400, detail="doctor_id required for hospital")
        hosp_id = user_id
        # Verify doctor belongs to this hospital
        doc = db.query(Doctors).filter(Doctors.id == doctor_id, Doctors.hospital_id == hosp_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Doctor not found in this hospital")
    else:
        raise HTTPException(status_code=403, detail="Invalid user role for doctor-hospital room")
        
    existing_room = db.query(DoctorHospitalConversationRoom).filter(
        DoctorHospitalConversationRoom.doctor_id == doc.id,
        DoctorHospitalConversationRoom.hospital_id == hosp_id
    ).first()
    
    if existing_room:
        if not existing_room.is_active:
            existing_room.is_active = True
            db.commit()
        return {"room_id": existing_room.id, "is_new": False}
        
    new_room = DoctorHospitalConversationRoom(
        doctor_id=doc.id,
        hospital_id=hosp_id,
        is_active=True
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    
    return {"room_id": new_room.id, "is_new": True}


@router.post("/room/doctor", status_code=201)
async def create_or_get_doctor_doctor_room(
    db: db_dependency,
    other_doctor_id: int = Query(...),
    token: str = Query(...)
):
    """Create or get existing conversation room between two doctors"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
        user_type = payload.get("type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    if user_type != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can chat with other doctors")
        
    if user_id == other_doctor_id:
        raise HTTPException(status_code=400, detail="Cannot chat with yourself")
        
    # Sort IDs for unique ordering (doctor1_id < doctor2_id)
    doc1_id, doc2_id = sorted([user_id, other_doctor_id])
    
    # Verify both doctors exist
    doc1 = db.query(Doctors).filter(Doctors.id == doc1_id).first()
    doc2 = db.query(Doctors).filter(Doctors.id == doc2_id).first()
    if not doc1 or not doc2:
        raise HTTPException(status_code=404, detail="Doctor not found")
        
    existing_room = db.query(DoctorDoctorConversationRoom).filter(
        DoctorDoctorConversationRoom.doctor1_id == doc1_id,
        DoctorDoctorConversationRoom.doctor2_id == doc2_id
    ).first()
    
    if existing_room:
        if not existing_room.is_active:
            existing_room.is_active = True
            db.commit()
        return {"room_id": existing_room.id, "is_new": False}
        
    new_room = DoctorDoctorConversationRoom(
        doctor1_id=doc1_id,
        doctor2_id=doc2_id,
        is_active=True
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    
    return {"room_id": new_room.id, "is_new": True}


@router.get("/messages/{room_id}", status_code=200)
async def get_conversation_messages(
    db: db_dependency,
    room_id: int,
    token: str = Query(...),
    chat_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    before_id: Optional[int] = Query(None)
):
    """Get messages for a conversation room with pagination"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
        user_type = payload.get("type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Check room type
    is_doc_hosp = False
    is_doc_doc = False
    
    if chat_type == "doctor_hospital":
        is_doc_hosp = True
    elif chat_type == "doctor_doctor":
        is_doc_doc = True
    elif chat_type == "user_doctor":
        is_doc_hosp = False
    elif user_type == "hospital":
        is_doc_hosp = True
    elif user_type == "user":
        is_doc_hosp = False
    else:
        # user_type is "doctor", but no chat_type is specified.
        # Check if the room exists in DoctorHospitalConversationRoom and doctor is part of it
        room_h = db.query(DoctorHospitalConversationRoom).filter(
            DoctorHospitalConversationRoom.id == room_id,
            DoctorHospitalConversationRoom.doctor_id == user_id
        ).first()
        if room_h:
            is_doc_hosp = True
        else:
            room_d = db.query(DoctorDoctorConversationRoom).filter(
                DoctorDoctorConversationRoom.id == room_id,
                (DoctorDoctorConversationRoom.doctor1_id == user_id) | (DoctorDoctorConversationRoom.doctor2_id == user_id)
            ).first()
            if room_d:
                is_doc_doc = True

    if is_doc_hosp:
        room = db.query(DoctorHospitalConversationRoom).filter(DoctorHospitalConversationRoom.id == room_id).first()
    elif is_doc_doc:
        room = db.query(DoctorDoctorConversationRoom).filter(DoctorDoctorConversationRoom.id == room_id).first()
    else:
        room = db.query(ConversationRoom).filter(ConversationRoom.id == room_id).first()
        
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if is_doc_hosp:
        if user_type == "doctor" and room.doctor_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if user_type == "hospital" and room.hospital_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif is_doc_doc:
        if user_type != "doctor" or (room.doctor1_id != user_id and room.doctor2_id != user_id):
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        if user_type == "user" and room.user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if user_type == "doctor" and room.doctor_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    if is_doc_hosp:
        query = db.query(DoctorHospitalConversationMessage).filter(DoctorHospitalConversationMessage.room_id == room_id)
        if before_id:
            query = query.filter(DoctorHospitalConversationMessage.id < before_id)
        messages = query.order_by(DoctorHospitalConversationMessage.created_at.desc()).limit(limit).all()
        
        # Mark messages as read
        if user_type == "doctor":
            db.query(DoctorHospitalConversationMessage).filter(
                DoctorHospitalConversationMessage.room_id == room_id,
                DoctorHospitalConversationMessage.sender_type == "hospital",
                DoctorHospitalConversationMessage.is_read == False
            ).update({"is_read": True})
        else:
            db.query(DoctorHospitalConversationMessage).filter(
                DoctorHospitalConversationMessage.room_id == room_id,
                DoctorHospitalConversationMessage.sender_type == "doctor",
                DoctorHospitalConversationMessage.is_read == False
            ).update({"is_read": True})
    elif is_doc_doc:
        query = db.query(DoctorDoctorConversationMessage).filter(DoctorDoctorConversationMessage.room_id == room_id)
        if before_id:
            query = query.filter(DoctorDoctorConversationMessage.id < before_id)
        messages = query.order_by(DoctorDoctorConversationMessage.created_at.desc()).limit(limit).all()
        
        # Mark messages as read
        db.query(DoctorDoctorConversationMessage).filter(
            DoctorDoctorConversationMessage.room_id == room_id,
            DoctorDoctorConversationMessage.sender_id != user_id,
            DoctorDoctorConversationMessage.is_read == False
        ).update({"is_read": True})
    else:
        query = db.query(ConversationMessage).filter(ConversationMessage.room_id == room_id)
        if before_id:
            query = query.filter(ConversationMessage.id < before_id)
        messages = query.order_by(ConversationMessage.created_at.desc()).limit(limit).all()
        
        # Mark messages as read
        if user_type == "user":
            db.query(ConversationMessage).filter(
                ConversationMessage.room_id == room_id,
                ConversationMessage.sender_type == "doctor",
                ConversationMessage.is_read == False
            ).update({"is_read": True})
        else:
            db.query(ConversationMessage).filter(
                ConversationMessage.room_id == room_id,
                ConversationMessage.sender_type == "user",
                ConversationMessage.is_read == False
            ).update({"is_read": True})
            
    db.commit()
    messages.reverse()
    
    return {
        "messages": [
            {
                "id": m.id,
                "sender_id": m.sender_id,
                "sender_type": getattr(m, "sender_type", "doctor"),
                "message": m.content,
                "message_type": m.message_type,
                "file_url": urljoin(BASE_URL, await generate_signed_url(m.attachment_url, user_id = user_id, user_role = user_type, directory = "documents")) if m.attachment_url else None,
                "is_read": m.is_read,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in messages
        ],
        "has_more": len(messages) == limit
    }


@router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve uploaded chat files"""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@router.put("/room/{room_id}/close", status_code=200)
async def close_conversation_room(
    db: db_dependency,
    room_id: int,
    token: str = Query(...)
):
    """Close/deactivate a conversation room"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
        user_type = payload.get("type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Check room type
    is_doc_hosp = False
    room = db.query(ConversationRoom).filter(ConversationRoom.id == room_id).first()
    if not room:
        room = db.query(DoctorHospitalConversationRoom).filter(DoctorHospitalConversationRoom.id == room_id).first()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        is_doc_hosp = True
        
    if is_doc_hosp:
        if user_type == "doctor" and room.doctor_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if user_type == "hospital" and room.hospital_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        if user_type == "user" and room.user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if user_type == "doctor" and room.doctor_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    room.is_active = False
    db.commit()
    
    return {"message": "Conversation room closed successfully"}


@router.get("/doctors/available", status_code=200)
async def get_available_doctors_for_chat(db : db_dependency, token: str = Query(...)):
    """Get list of doctors/patients/hospitals available for chat"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
        user_type = payload.get("type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # For doctors, return assigned patients AND their hospital
    if user_type == "doctor":
        assigned = db.query(AssignedDoctors).filter(
            AssignedDoctors.doctor_id == user_id
        ).all()
        
        patient_ids = [a.user_id for a in assigned]
        patients = db.query(Users).filter(Users.id.in_(patient_ids)).all()
        
        patient_result = []
        for patient in patients:
            existing_room = db.query(ConversationRoom).filter(
                ConversationRoom.user_id == patient.id,
                ConversationRoom.doctor_id == user_id,
                ConversationRoom.is_active == True
            ).first()
            
            patient_result.append({
                "id": patient.id,
                "name": patient.name,
                "email": patient.email,
                "has_active_chat": existing_room is not None,
                "room_id": existing_room.id if existing_room else None,
                "is_online": manager.is_user_online(patient.id, "user")
            })
            
        # Get doctor's hospital
        doc = db.query(Doctors).filter(Doctors.id == user_id).first()
        hosp_result = None
        if doc:
            hosp = db.query(Hospitals).filter(Hospitals.id == doc.hospital_id).first()
            if hosp:
                existing_room = db.query(DoctorHospitalConversationRoom).filter(
                    DoctorHospitalConversationRoom.doctor_id == user_id,
                    DoctorHospitalConversationRoom.hospital_id == hosp.id,
                    DoctorHospitalConversationRoom.is_active == True
                ).first()
                hosp_result = {
                    "id": hosp.id,
                    "name": hosp.name,
                    "email": hosp.email,
                    "has_active_chat": existing_room is not None,
                    "room_id": existing_room.id if existing_room else None,
                    "is_online": manager.is_user_online(hosp.id, "hospital")
                }
        
        return {"patients": patient_result, "hospital": hosp_result}
    
    # For users, return assigned doctors
    elif user_type == "user":
        assigned = db.query(AssignedDoctors).filter(
            AssignedDoctors.user_id == user_id
        ).all()
        
        doctor_ids = [a.doctor_id for a in assigned]
        doctors = db.query(Doctors).filter(Doctors.id.in_(doctor_ids)).all()
        
        result = []
        for doctor in doctors:
            existing_room = db.query(ConversationRoom).filter(
                ConversationRoom.user_id == user_id,
                ConversationRoom.doctor_id == doctor.id,
                ConversationRoom.is_active == True
            ).first()
            
            result.append({
                "id": doctor.id,
                "name": doctor.name,
                "speciality": doctor.speciality,
                "email": doctor.email,
                "has_active_chat": existing_room is not None,
                "room_id": existing_room.id if existing_room else None,
                "is_online": manager.is_user_online(doctor.id, "doctor")
            })
        
        return {"doctors": result}
    
    # For hospitals, return their doctors
    elif user_type == "hospital":
        doctors = db.query(Doctors).filter(Doctors.hospital_id == user_id).all()
        
        result = []
        for doctor in doctors:
            existing_room = db.query(DoctorHospitalConversationRoom).filter(
                DoctorHospitalConversationRoom.doctor_id == doctor.id,
                DoctorHospitalConversationRoom.hospital_id == user_id,
                DoctorHospitalConversationRoom.is_active == True
            ).first()
            
            result.append({
                "id": doctor.id,
                "name": doctor.name,
                "speciality": doctor.speciality,
                "email": doctor.email,
                "has_active_chat": existing_room is not None,
                "room_id": existing_room.id if existing_room else None,
                "is_online": manager.is_user_online(doctor.id, "doctor")
            })
            
        return {"doctors": result}
    
    else:
        raise HTTPException(status_code=403, detail="Invalid user type")