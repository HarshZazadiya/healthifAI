import os
import uvicorn
import requests
import urllib.parse
from typing import Annotated
from jose import jwt, JWTError
from logs.logging import logger
from database import SessionLocal
from database import engine, Base
from requests.compat import urljoin
from fastapi import Request, Depends
from utils.helper import bcrypt_context
from fastapi import HTTPException, FastAPI
from contextlib import asynccontextmanager
from logs.middleware import log_middleware
from utils.redis_config import redis_client
from fastapi.staticfiles import StaticFiles
from schedulers.logs_deleter import cleanup_logs
from fastapi.middleware.cors import CORSMiddleware
from models import Users, Wallet, Doctors, Hospitals
from utils.helper import bcrypt_context, oauth2_bearer
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from utils.google_credential_handler import handle_google_login
from utils.dependencies import requester_dependency, db_dependency
from utils.get_current_requester import get_current_requester_by_token
from routers import user, doctor, admin, auth, default, chat, hospital
from fastapi.responses import FileResponse, RedirectResponse, HTMLResponse
from utils.get_current_requester import get_current_requester_by_id_and_role

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──────────────────────────────────────────────
    logger.info("=" * 50)
    logger.info("Application starting up...")

    # 0. Configure Redis
    # logger.info("Configuring Redis...")
    # configure_redis()

    # 1. Initialize FAISS
    # logger.info("Initializing vector store...")
    # store = get_vector_store()
    # logger.info(f"FAISS ready with {store.index.ntotal} vectors")

    # 3. Initialize async Postgres checkpointer
    # await init_checkpointer()

    # 4. Create default admin if none exists
    db = SessionLocal()
    try:
        existing_admin = db.query(Users).filter(Users.role == "admin").first()
        existing_wallet = db.query(Wallet).filter(Wallet.role == "admin").first()
        if not existing_wallet and not existing_admin:
            logger.info("No admin user found, creating default admin...")
            username = os.getenv("DEFAULT_ADMIN_NAME")
            email    = os.getenv("DEFAULT_ADMIN_EMAIL")
            password = os.getenv("DEFAULT_ADMIN_PASSWORD")
            phone_number = os.getenv("DEFAULT_ADMIN_PHONE_NUMBER")
            account_type = "PRIMIUM"

            default_admin = Users(
                name = username,
                email = email,
                phone_number = phone_number,
                hashed_password = bcrypt_context.hash(password),
                role = "admin",
                account_type = account_type
            )
            db.add(default_admin)
            db.commit()
            logger.info(f"Default admin created: {email} / {password}")
            
            # Create admin wallet
            admin_wallet = Wallet(
                role = "admin",
                user_id = default_admin.id,
                balance = 0
            )
            db.add(admin_wallet)
            db.commit()
            logger.info(f"Default admin wallet created")
        else:
            logger.info("Admin user already exists")

    except Exception as e:
        logger.info(f"Error creating admin: {e}")
    finally:
        db.close()

    logger.info("Startup complete")
    logger.info("=" * 50)

    # ── APP RUNS HERE ────────────────────────────────────────
    yield

    # ── SHUTDOWN ──────────────────────────────────────────────
    logger.info("\n" + "=" * 50)
    logger.info("Application shutting down...")

    # Close Redis connection
    if redis_client:
        await redis_client.aclose()
        logger.info("Redis connection closed")
    
    # Clean up logs
    try:
        cleanup_logs()
    except Exception as e:
        print(f"Error cleaning logs: {e}")
    
    # await close_checkpointer()
    # cleanup()
    # logger.info("=" * 50)


app = FastAPI(lifespan = lifespan)

Base.metadata.create_all(bind = engine)

try:
    app.mount("/documents", StaticFiles(directory = "documents"), name = "documents")
    app.mount("/frontend", StaticFiles(directory = "frontend"), name = "frontend")

except Exception as e:
    logger.info(f"Error mounting static files: {e}")
    logger.info("===== trying to create new folder =====")
    try:
        os.mkdir("documents")
        app.mount("/documents", StaticFiles(directory = "documents"), name = "documents")
        logger.info("New folder created")
        os.mkdir("frontend")
        app.mount("/frontend", StaticFiles(directory = "frontend"), name = "frontend")
        logger.info("New folder created")
    except Exception as e:
        logger.info(f"Error creating new folder: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(BaseHTTPMiddleware, dispatch = log_middleware)

app.include_router(auth.router)
app.include_router(default.router)
app.include_router(user.router)
app.include_router(doctor.router)
app.include_router(hospital.router)
app.include_router(admin.router)
app.include_router(chat.router)

# Google OAuth constants
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

@app.get("/")
async def health_check():
    return {"message" : "Health is good"}

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")

@app.get("/auth/google")
async def google_auth(
    request: Request,
    token: str = None,
    db: db_dependency = None,
):
    # Try getting token from query parameters first, then check Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise HTTPException(status_code = 401, detail = "Authentication required")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms = [ALGORITHM])
        user_id = payload.get("id")
        user_role = payload.get("role")
        if not user_id or not user_role:
            raise HTTPException(status_code = 401, detail = "Invalid token details")
    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid token")

    state = f"{user_id}_{user_role}"
    
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.send",
        "access_type": "offline",
        "prompt": "consent",
        "state": state
    }

    oauth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return RedirectResponse(oauth_url)

async def get_google_user(access_token):
    url = "https://www.googleapis.com/oauth2/v2/userinfo"
    headers = {"Authorization" : f"Bearer {access_token}"}
    res = requests.get(url, headers = headers)
    return res.json()

@app.get("/auth/callback")
async def google_callback(request: Request, db : db_dependency):
    code = request.query_params.get("code")
    state = request.query_params.get("state")

    if not code:
        return {"error" : "No code provided"}
    
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code" : code,
        "client_id" : CLIENT_ID,
        "client_secret" : CLIENT_SECRET,
        "redirect_uri" : REDIRECT_URI,
        "grant_type" : "authorization_code"
    }
    response = requests.post(token_url, data=data)
    google_tokens = response.json()
    
    # get user info from state
    if not state:
        return {"error" : "No state provided"}
    
    user_id, role = state.split("_")
    actual_user_id = int(user_id)
    actual_role = role.lower()
    
    requester = await get_current_requester_by_id_and_role(actual_user_id, actual_role, db)

    if "refresh_token" not in google_tokens:
        return {"error" : "Failed to get refresh token", "details" : google_tokens}
    if "access_token" not in google_tokens:
        return {"error" : "Failed to get access token", "details" : google_tokens}
    
    user_info = await get_google_user(google_tokens["access_token"])
    logger.info(f"Google user info : {user_info}")
    logger.info(f"Google Tokens : {google_tokens}")

    user_google_email = user_info.get("email")
    user_google_name = user_info.get("name")
    user_google_pic = user_info.get("picture")
    
    if not user_google_email:
        return {"error": "Failed to get user email"}
    
    # get jwt token by user info
    from fastapi.responses import RedirectResponse

    try:
        jwt_token = await handle_google_login(requester.email, actual_user_id, actual_role, user_google_email, user_google_name, user_google_pic, google_tokens.get("access_token"), google_tokens.get("refresh_token"), db)
        react_base_url = os.getenv("REACT_BASE_URL")
        react_url = urljoin(react_base_url, os.getenv("FRONTEND_URL"))
        
        # Create redirect response
        response = RedirectResponse(url = react_url, status_code = 302)
        
        # Set HTTP-only cookie
        response.set_cookie(
            key = "auth_token",
            value = jwt_token,
            httponly = True,
            secure = False,  # Set to True in production with HTTPS
            samesite = "lax",
            max_age = 86400,  # 24 hours
            path = "/"
        )
        
        return response
        
    except HTTPException as e:
        return {"error" : e.detail}
    finally:
        db.close()

@app.get("/connect-status")
async def check_google_connect_status(db : db_dependency, user_id : int, user_role : str):
    role = user_role
    user_id = int(user_id)
    
    if role == "user":
        person = db.query(Users).filter(Users.id == user_id).first()
    elif role == "doctor":
        person = db.query(Doctors).filter(Doctors.id == user_id).first()
    elif role == "hospital":
        person = db.query(Hospitals).filter(Hospitals.id == user_id).first()
    
    if not person:
        raise HTTPException(status_code = 404, detail = "User not found")
    
    is_connected = bool(person.google_access_token)
    if is_connected:
        return {
            "NOTE" : "The connection is successful, CLOSE THIS TAB AND REFRESH THE MAIN APPLICATION PAGE TO SEE THE CHANGES REFLECTED IN YOUR PROFILE",
            "google_connected" : is_connected,
            "google_name" : person.google_name,
            "google_email_id" : person.email,
            "google_connected_status" : is_connected
        }
    else:
        return {
            "NOTE" : "No Google account connected. Please connect your Google account from the profile page.",
            "google_connected_status" : is_connected
        }
    
if __name__ == "__main__":
    uvicorn.run(app, host = "0.0.0.0", port = 8000)