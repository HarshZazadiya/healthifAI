import os
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    # Prevent uvicorn from overriding the policy to ProactorEventLoopPolicy
    asyncio.set_event_loop_policy = lambda policy: None
    
    # Override uvicorn's loop factory to force it to use SelectorEventLoop
    try:
        import uvicorn.loops.asyncio
        uvicorn.loops.asyncio.asyncio_loop_factory = lambda use_subprocess=False: asyncio.SelectorEventLoop
    except ImportError:
        pass
from routers import user, doctor, admin, auth, default, chat, hospital, chatbot
import uvicorn
from fastapi import FastAPI
from logs.logging import logger
from models import Users, Wallet
from utils.helper import bcrypt_context
from contextlib import asynccontextmanager
from logs.middleware import log_middleware
from utils.redis_config import redis_client
from database import engine, Base, SessionLocal
from schedulers.logs_deleter import cleanup_logs
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from AI.graph import init_checkpointer, close_checkpointer

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

    await init_checkpointer()

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
    # try:
    #     cleanup_logs()
    # except Exception as e:
    #     print(f"Error cleaning logs: {e}")
    
    await close_checkpointer()
    # cleanup()
    logger.info("=" * 50)


app = FastAPI(lifespan = lifespan)

Base.metadata.create_all(bind = engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL"),
        os.getenv("REACT_BASE_URL")
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
app.include_router(chatbot.router)

# Google OAuth constants
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

@app.get("/")
async def health_check():
    return {"message" : "Health is good"}

if __name__ == "__main__":
    uvicorn.run(app, host = "0.0.0.0", port = 8000)