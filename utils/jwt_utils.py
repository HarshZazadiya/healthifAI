import os
from datetime import datetime, timedelta, timezone
from jose import jwt

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))


def create_access_token(entity_id: int, entity_type: str, role: str):
    payload = {
        "id": entity_id,
        "type": entity_type,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(entity_id: int, entity_type: str, role: str):
    payload = {
        "id": entity_id,
        "type": entity_type,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "token_type": "refresh",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
