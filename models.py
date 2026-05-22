from database import Base
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import JSON, Column, Integer, ForeignKey, String, Boolean, DateTime, Float, Text, UniqueConstraint, Numeric

class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key = True, index = True)
    name = Column(String(45), unique = True, nullable = False)
    phone_number = Column(String(100), nullable = True)
    email = Column(String(200), unique = True, nullable = False)
    hashed_password = Column(String(200), nullable = False)
    lat = Column(Numeric(10, 8), nullable = True)
    lon = Column(Numeric(10, 8), nullable = True)
    role = Column(String, default = "user")
    predicted_diesease = Column(String(100), nullable = True) # for chatbot only
    account_type = Column(String, default = "NORMAL")
    google_email_id = Column(String(200), unique = True, nullable = True)
    google_access_token = Column(String(500), nullable = True)
    google_refresh_token = Column(String(500), nullable = True)
    google_profile_pic = Column(String(2000), nullable = True)
    google_name = Column(String(200), nullable = True)
    is_active = Column(Boolean, default = True)

class Symptoms(Base):
    __tablename__ = "symptoms"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable = False)
    symptom = Column(String(100), nullable = False)
    severity = Column(Integer, nullable = False)
    date = Column(DateTime, nullable = False, server_default = func.now())

class Doctors(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key = True, index = True)
    name = Column(String(100), nullable = False)
    phone_number = Column(String(100), nullable = True)
    email = Column(String(200), unique = True, nullable = False)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable = False)
    availability = Column(Boolean, default = True)
    hashed_password = Column(String(200), nullable = False)
    specialty = Column(String(100), nullable = False, default = "General")
    fees = Column(Integer, nullable = False, default = 0)
    appointment_fees = Column(Integer, nullable = False, default = 0)
    current_cases = Column(Integer, nullable = False, default = 0)
    limit = Column(Integer, nullable = False, default = 0)
    google_email_id = Column(String(200), unique = True, nullable = True)
    google_access_token = Column(String(500), nullable = True)
    google_refresh_token = Column(String(500), nullable = True)
    google_profile_pic = Column(String(2000), nullable = True)
    google_name = Column(String(200), nullable = True)
    rating = Column(Numeric(10, 2), default = 0)
    is_active = Column(Boolean, default = True)

class Hospitals(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key = True, index = True)
    name = Column(String(100), nullable = False)
    email = Column(String(200), unique = True, nullable = False)
    hashed_password = Column(String(200), nullable = False)
    address = Column(String(100), nullable = False)
    city = Column(String(100), nullable = False)
    state = Column(String(100), nullable = False)
    zip = Column(String(100), nullable = False)
    phone_number = Column(String(100), nullable = False)
    lat = Column(Numeric(10, 8), nullable = True)
    lon = Column(Numeric(10, 8), nullable = True)
    google_email_id = Column(String(200), unique = True, nullable = True)
    cases = Column(Integer, default = 0, nullable = True)
    google_access_token = Column(String(500), nullable = True)
    google_refresh_token = Column(String(500), nullable = True)
    google_profile_pic = Column(String(2000), nullable = True)
    google_name = Column(String(200), nullable = True)
    rating = Column(Numeric(10, 2), default = 0)
    charges = Column(Numeric(10, 2), default = 0)
    merged_wallet_id = Column(Integer, nullable = True, default = None)
    is_active = Column(Boolean, default = True)

# TODO : add medication support for user, doctor and hospital
# class medications(Base):
#     __tablename__ = "medications"

#     id = Column(Integer, primary_key = True, index = True)
#     name = Column(String(100), nullable = False)
#     user_id = Column(Integer, ForeignKey("users.id"), nullable = False)
#     doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable = False)
#     hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable = False)
#     before_or_after = Column(String(10), nullable = False, default = "AFTER")
#     duration = Column(Integer, nullable = True, default = 0)
#     quantity = Column(String(100), nullable = False, default = 1)
#     morning = Column(Boolean, nullable = False, default = True)
#     afternoon = Column(Boolean, nullable = False, default = False)
#     night = Column(Boolean, nullable = False, default = True)
#     note = Column(String(100), nullable = True)
#     cost = Column(Numeric(10, 2), nullable = False, default = 0)
#     date = Column(DateTime, nullable = False, server_default = func.now())

class Cases(Base):
    __tablename__ = "cases"
    
    id = Column(Integer, primary_key = True, index = True)
    case_id = Column(Integer, nullable = False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable = False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable = False)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable = False)
    diesease = Column(String(100), nullable = False, default = "Not Dignosed Yet")
    symptom_ids = Column(ARRAY(Integer), nullable = True, default = [])
    user_doc_ids = Column(ARRAY(Integer), nullable = True, default = [])
    doctor_doc_ids = Column(ARRAY(Integer), nullable = True, default = [])
    date = Column(DateTime, nullable = False, server_default = func.now())
    last_updated = Column(DateTime, nullable = False, server_default = func.now())
    status = Column(String(100), nullable = False)
    cost = Column(Numeric(10, 2), nullable = False, default = 0)  

class AssignedDoctors(Base):
    __tablename__ = "assigned_doctors"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable = False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable = False)
    date = Column(DateTime, nullable = False, server_default = func.now())

class Priority(Base):
    __tablename__ = "priority"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable = False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable = False)
    diesease = Column(String(100), nullable = False)
    severity = Column(Integer, nullable = False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable = False)

class Ratings(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable = False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable = False)
    rating = Column(Integer, nullable = False)
    description = Column(String(5000), nullable = False)
    date = Column(DateTime, nullable = False, server_default = func.now())

class Appointments(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable = False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable = False)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable = False)
    diesease = Column(String(100), nullable = True)
    date = Column(DateTime, nullable = False, server_default = func.now())
    status = Column(String(100), nullable = False)

class Wallet(Base):
    __tablename__ = "wallet"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, nullable = False)
    role = Column(String(100), nullable = False)
    balance = Column(Numeric(10, 2), nullable = False)

class Documents(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, nullable = False)
    role = Column(String(100), nullable = False)
    document_path = Column(String(100), nullable = False)
    type = Column(String(100), nullable = False, default = "REPORT")
    doc_class = Column(String(100), nullable = False, default = "NOT CLASSIFIED")
    date = Column(DateTime, nullable = False, server_default = func.now())

class Notifications(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, nullable = False)
    role = Column(String(100), nullable = False)
    message = Column(String(100), nullable = False)
    created_at = Column(DateTime, nullable = False, server_default = func.now())
    read = Column(Boolean, default = False)

class UserPayments(Base):
    __tablename__ = "user_payments"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, nullable = False)
    role = Column(String(100), nullable = False)
    date = Column(DateTime, nullable = False, server_default = func.now())
    note = Column(String(100), nullable = True)
    type = Column(String(100), nullable = False)
    amount = Column(Numeric(10, 2), nullable = False)

class DoctorPayments(Base):
    __tablename__ = "doctor_payments"

    id = Column(Integer, primary_key = True, index = True)
    doctor_id = Column(Integer, nullable = False)
    date = Column(DateTime, nullable = False, server_default = func.now())
    note = Column(String(100), nullable = True)
    type = Column(String(100), nullable = False)
    amount = Column(Numeric(10, 2), nullable = False)

class ChatThread(Base):
    __tablename__ = "chat_threads"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, nullable = False)
    role = Column(String(20), nullable = False)
    thread_name = Column(String(200), nullable = False, default = "New Chat")
    created_at = Column(DateTime, server_default = func.now())

    messages = relationship("ChatMessage", back_populates = "thread", cascade = "all, delete")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key = True, index = True)
    thread_id = Column(Integer, ForeignKey("chat_threads.id"), nullable = False)
    role = Column(String(20))
    content = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    thread = relationship("ChatThread", back_populates="messages")

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, nullable = False)
    user_role = Column(String(20), nullable = False)
    sensitive_tools = Column(JSON, default = [])

class Memories(Base):
    __tablename__ = "memories"

    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, nullable = False)
    user_role = Column(String(20), nullable = False)
    type = Column(String(20), nullable = False)
    key = Column(String(200), nullable = False)
    value = Column(Text, nullable = False)
    embedding = Column(Vector(384), nullable = False)
    created_at = Column(DateTime, server_default = func.now())

# ============================================
# USER-DOCTOR CONVERSATION MODELS
# ============================================

class ConversationRoom(Base):
    __tablename__ = "conversation_rooms"
    
    id = Column(Integer, primary_key = True, index = True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable = False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable = False)
    created_at = Column(DateTime, server_default = func.now())
    updated_at = Column(DateTime, server_default = func.now(), onupdate = func.now())
    is_active = Column(Boolean, default = True)
    
    # Relationships
    user = relationship("Users", foreign_keys = [user_id], backref = "conversation_rooms")
    doctor = relationship("Doctors", foreign_keys = [doctor_id], backref = "conversation_rooms")
    messages = relationship("ConversationMessage", back_populates = "room", cascade = "all, delete")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('user_id', 'doctor_id', name = 'unique_user_doctor_conversation'),
    )

class ConversationMessage(Base):
    __tablename__ = "conversation_messages"
    
    id = Column(Integer, primary_key = True, index = True)
    room_id = Column(Integer, ForeignKey("conversation_rooms.id"), nullable = False)
    sender_id = Column(Integer, nullable = False)
    sender_type = Column(String(20), nullable = False)
    content = Column(Text, nullable = True)
    message_type = Column(String(20), default = "text")
    attachment_url = Column(String(500), nullable = True)
    is_read = Column(Boolean, default = False)
    created_at = Column(DateTime, server_default = func.now())
    
    # Relationships
    room = relationship("ConversationRoom", back_populates = "messages")
    attachments = relationship("ConversationAttachment", back_populates = "message", cascade = "all, delete")

class ConversationAttachment(Base):
    __tablename__ = "conversation_attachments"
    
    id = Column(Integer, primary_key = True, index = True)
    message_id = Column(Integer, ForeignKey("conversation_messages.id"), nullable = False)
    file_name = Column(String(255), nullable = False)
    file_path = Column(String(500), nullable = False)
    file_type = Column(String(50), nullable = False)
    file_size = Column(Integer, nullable = False)
    created_at = Column(DateTime, server_default = func.now())
    
    # Relationships
    message = relationship("ConversationMessage", back_populates = "attachments")

# ============================================
# DOCTOR-HOSPITAL CONVERSATION MODELS
# ============================================

class DoctorHospitalConversationRoom(Base):
    __tablename__ = "doctor_hospital_conversation_rooms"
    
    id = Column(Integer, primary_key = True, index = True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable = False)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable = False)
    created_at = Column(DateTime, server_default = func.now())
    updated_at = Column(DateTime, server_default = func.now(), onupdate = func.now())
    is_active = Column(Boolean, default = True)
    
    # Relationships
    doctor = relationship("Doctors", foreign_keys = [doctor_id], backref = "hospital_rooms")
    hospital = relationship("Hospitals", foreign_keys = [hospital_id], backref = "doctor_rooms")
    messages = relationship("DoctorHospitalConversationMessage", back_populates = "room", cascade = "all, delete")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('doctor_id', 'hospital_id', name = 'unique_doctor_hospital_conversation'),
    )

class DoctorHospitalConversationMessage(Base):
    __tablename__ = "doctor_hospital_conversation_messages"
    
    id = Column(Integer, primary_key = True, index = True)
    room_id = Column(Integer, ForeignKey("doctor_hospital_conversation_rooms.id"), nullable = False)
    sender_id = Column(Integer, nullable = False)
    sender_type = Column(String(20), nullable = False) # "doctor" or "hospital"
    content = Column(Text, nullable = True)
    message_type = Column(String(20), default = "text")
    attachment_url = Column(String(500), nullable = True)
    is_read = Column(Boolean, default = False)
    created_at = Column(DateTime, server_default = func.now())
    
    # Relationships
    room = relationship("DoctorHospitalConversationRoom", back_populates = "messages")

# ============================================
# DOCTOR-DOCTOR CONVERSATION MODELS
# ============================================

class DoctorDoctorConversationRoom(Base):
    __tablename__ = "doctor_doctor_conversation_rooms"
    
    id = Column(Integer, primary_key = True, index = True)
    doctor1_id = Column(Integer, ForeignKey("doctors.id"), nullable = False)
    doctor2_id = Column(Integer, ForeignKey("doctors.id"), nullable = False)
    created_at = Column(DateTime, server_default = func.now())
    updated_at = Column(DateTime, server_default = func.now(), onupdate = func.now())
    is_active = Column(Boolean, default = True)
    
    # Relationships
    doctor1 = relationship("Doctors", foreign_keys = [doctor1_id], backref = "doctor_initiated_rooms")
    doctor2 = relationship("Doctors", foreign_keys = [doctor2_id], backref = "doctor_received_rooms")
    messages = relationship("DoctorDoctorConversationMessage", back_populates = "room", cascade = "all, delete")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('doctor1_id', 'doctor2_id', name = 'unique_doctor_doctor_conversation'),
    )

class DoctorDoctorConversationMessage(Base):
    __tablename__ = "doctor_doctor_conversation_messages"
    
    id = Column(Integer, primary_key = True, index = True)
    room_id = Column(Integer, ForeignKey("doctor_doctor_conversation_rooms.id"), nullable = False)
    sender_id = Column(Integer, nullable = False)
    content = Column(Text, nullable = True)
    message_type = Column(String(20), default = "text")
    attachment_url = Column(String(500), nullable = True)
    is_read = Column(Boolean, default = False)
    created_at = Column(DateTime, server_default = func.now())
    
    # Relationships
    room = relationship("DoctorDoctorConversationRoom", back_populates = "messages")