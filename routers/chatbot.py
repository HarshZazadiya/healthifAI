import os
from pydantic import BaseModel
from AI.graph import run_agent
from logs.logging import logger
from typing import Optional, List
from database import SessionLocal
from sqlalchemy.orm import Session
from models import ChatThread, ChatMessage
from fastapi import APIRouter, HTTPException
from utils.dependencies import db_dependency, requester_dependency
from AI.config.user_config import get_requester_sensitive_tools, update_requester_sensitive_tools

router = APIRouter(
    prefix = "/chatbot", 
    tags = ["Chatbot"]
)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")

# ============================================================
# PYDANTIC MODELS
# ============================================================
class ChatRequest(BaseModel):
    message : str
    thread_id : Optional[int] = None
    human_approval : Optional[str] = None     # "yes" / "no" — sent on HITL resume

class ChatResponse(BaseModel):
    response : str
    thread_id : int
    role : str
    hitl_required : bool = False              # True when waiting for user approval
    hitl_tools : Optional[List[str]] = None   # which sensitive tools need approval
    tools_used : Optional[List[dict]] = None  # tool calls made: [{name, args}, ...]

class ThreadInfo(BaseModel):
    id : int
    created_at : str
    last_message : Optional[str] = None
    message_count : int
    thread_name : Optional[str] = None        # from ChatThread.thread_name column

class MessageInfo(BaseModel):
    id : int
    role : str
    content : str
    created_at : Optional[str] = None

class RenameRequest(BaseModel):
    thread_name: str

class UpdateSettingsRequest(BaseModel):
    tools: list[str]

# ============================================================
# THREAD MANAGEMENT
# ============================================================
def get_or_create_thread(requester_info : dict, thread_id : Optional[int] = None):
    """Get existing thread or create new one (with owner isolation)"""
    db = SessionLocal() 
    try :
        if thread_id:
            # Verify thread belongs to requester
            thread = db.query(ChatThread).filter(
                ChatThread.id == thread_id,
                ChatThread.user_id == requester_info["id"],
                ChatThread.role == requester_info["role"]
            ).first()
            if thread:
                return thread
        
        # Create new thread
        thread = ChatThread(
            user_id = requester_info["id"],
            role = requester_info["role"]
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)
        logger.info(f" Created new thread : {thread.id} for {requester_info['name']}")
        return thread
    except Exception as e:
        raise HTTPException(status_code = 500, detail = str(e))
    finally:
        db.close()

def save_message(db: Session, thread_id: int, role: str, content: str):
    """Save a message to database"""
    msg = ChatMessage(thread_id = thread_id, role = role, content = content)
    db.add(msg)
    db.commit()

def get_conversation_history(db : db_dependency, thread_id: int, limit : int = 10) -> List[dict]:
    """Get conversation history for context"""
    messages = db.query(ChatMessage).filter(ChatMessage.thread_id == thread_id).order_by(ChatMessage.created_at.desc()).limit(limit).all()
    
    # Return in chronological order
    context = []
    for msg in reversed(messages):
        context.append({
            "role" : msg.role,
            "content" : msg.content
        })
    
    return context

# ============================================================
# MAIN CHAT ENDPOINT
# ============================================================
@router.post("/ask", response_model = ChatResponse)
async def ask_chat(db : db_dependency, request : ChatRequest, requester : requester_dependency):
    """Main chat endpoint - handles normal messages and HITL approval responses"""
    try:
        thread = get_or_create_thread(requester, request.thread_id)

        logger.info(f"\n{'='*60}")
        logger.info(f"  Processing message from {requester['name']} ({requester['role']})")
        logger.info(f"  Thread : {thread.id}")
        logger.info(f"  Message : {request.message}")
        if request.human_approval:
            logger.info(f" Human approval : {request.human_approval}")
        logger.info(f"{'='*60}")

        requester_sensitive_tools = get_requester_sensitive_tools(db, requester["id"], requester["role"]) 

        requester_info = {
            "id" : requester["id"],
            "role" : requester["role"],
            "name" : requester["name"],
            "sensitive_tools" : requester_sensitive_tools
        }

        # ── HITL resume: requester replied yes/no ─────────────────
        if request.human_approval is not None:
            approval = request.human_approval.strip().lower()

            save_message(db, thread.id, "requester", f"[Approval : {request.human_approval}] {request.message}")

            result = await run_agent(
                requester_input = request.message,
                requester_info = requester_info,
                thread_id = thread.id,
                human_approval = approval,
            )

            save_message(db, thread.id, "assistant", result["content"])
            return ChatResponse(
                response = result["content"],
                thread_id = thread.id,
                role = requester["role"],
                tools_used = result.get("tools_used", []),
            )

        # ── Normal first-turn message ─────────────────────────
        save_message(db, thread.id, "requester", request.message)

        result = await run_agent(
            user_input = request.message,
            user_info = requester_info,
            thread_id = thread.id,
        )

        # ── HITL interrupt: agent needs approval ──────────────
        if result["type"] == "hitl_required":
            save_message(db, thread.id, "assistant", result["content"])
            return ChatResponse(
                response = result["content"],
                thread_id = thread.id,
                role = requester["role"],
                hitl_required = True,
                hitl_tools = result.get("tools", []),
            )

        # ── Normal response ───────────────────────────────────
        save_message(db, thread.id, "assistant", result["content"])
        return ChatResponse(
            response = result["content"],
            thread_id = thread.id,
            role = requester["role"],
            tools_used = result.get("tools_used", []),
        )

    except Exception as e:
        logger.info(f"Error in chat: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code = 500, detail = str(e))

# ============================================================
# THREAD MANAGEMENT ENDPOINTS
# ============================================================
@router.get("/threads", response_model=List[ThreadInfo])
async def get_threads(db : db_dependency, requester : requester_dependency):
    """Get all threads for current requester"""
    threads = db.query(ChatThread).filter(ChatThread.user_id == requester["id"], ChatThread.role == requester["role"]).order_by(ChatThread.created_at.desc()).all()
    
    result = []
    for thread in threads:
        last_msg = db.query(ChatMessage).filter(ChatMessage.thread_id == thread.id).order_by(ChatMessage.created_at.desc()).first()
        
        msg_count = db.query(ChatMessage).filter(ChatMessage.thread_id == thread.id).count()
        
        result.append(ThreadInfo(
            id = thread.id,
            created_at = thread.created_at.isoformat() if thread.created_at else "",
            last_message = last_msg.content if last_msg else None,
            message_count = msg_count,
            thread_name = thread.thread_name,
        ))
    
    return result

@router.get("/threads/{thread_id}/messages", response_model = List[MessageInfo])
async def get_thread_messages(db : db_dependency, thread_id: int, requester : requester_dependency):
    """Get all messages in a thread"""
    # Verify thread belongs to requester
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id,
        ChatThread.user_id == requester["id"],
        ChatThread.role == requester["role"]).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    messages = db.query(ChatMessage).filter(ChatMessage.thread_id == thread_id).order_by(ChatMessage.created_at).all()
    
    return [
        MessageInfo(
            id = m.id,
            role = m.role,
            content = m.content,
            created_at = m.created_at.isoformat() if m.created_at else None
        )
        for m in messages
    ]

@router.delete("/threads/{thread_id}")
async def delete_thread(db : db_dependency, thread_id: int, requester : requester_dependency):
    """Delete a thread and all its messages"""
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id, ChatThread.user_id == requester["id"], ChatThread.role == requester["role"]).first()
    
    if not thread:
        raise HTTPException(status_code = 404, detail = "Thread not found")
    
    db.delete(thread)
    db.commit()
    
    return {"message": "Thread deleted successfully"}

@router.patch("/threads/{thread_id}/rename")
async def rename_thread(db : db_dependency, thread_id : int, body : RenameRequest, requester : requester_dependency):
    """Rename a thread using the thread_name column on ChatThread"""
    thread = db.query(ChatThread).filter(
        ChatThread.id == thread_id,
        ChatThread.user_id == requester["id"],
        ChatThread.role == requester["role"]
    ).first()

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    thread.thread_name = body.thread_name.strip()[:200]
    db.commit()
    return {"id": thread_id, "thread_name": thread.thread_name}

@router.post("/settings/hitl")
async def update_hitl_settings(db : db_dependency, body : UpdateSettingsRequest, requester : requester_dependency):
    settings = update_requester_sensitive_tools(db, requester["id"], requester["role"], body.tools)

    return {
        "message" : "Settings updated",
        "sensitive_tools" : settings.sensitive_tools
    }

@router.get("/settings/hitl")
async def get_hitl_settings(db : db_dependency, requester : requester_dependency):
    tools = get_requester_sensitive_tools(db, requester["id"], requester["role"])
    return {"sensitive_tools": tools}


@router.get("/tools")
async def get_available_tools(requester : requester_dependency):

    role = requester["role"]

    # Import here to avoid circular imports
    from AI.tools.admin_tools import admin_tools # type:ignore
    from AI.tools.doctor_tools import doctor_tools # type:ignore 
    from AI.tools.requester_tools import requester_tools # type:ignore
    from AI.tools.default_tools import default_tools # type:ignore
    from AI.local_mcp.mcp_manager import get_mcp_tools 
    from AI.graph import search_documents # type:ignore

    tools = [search_documents]
    mcp_tools = await get_mcp_tools()
    if role == "admin":
        tools.extend(admin_tools)
    elif role == "host":
        tools.extend(doctor_tools)
    elif role == "requester":
        tools.extend(requester_tools)

    tools.extend(default_tools)
    tools.extend(mcp_tools)
    # Format response
    tool_list = []

    for t in tools:
        try:
            name = getattr(t, "name", None)
            description = getattr(t, "description", None)

            # fallback for weird tools
            if not name:
                name = str(t)

            tool_list.append({
                "name": str(name),
                "description": str(description) if description else ""
            })

        except Exception as e:
            logger.info("="*50)
            logger.info(f"Error processing tool: {t}")
            logger.info(f"Skipping tool due to error : {e}")
            logger.info("="*50)
            continue
    return {"tools": tool_list}