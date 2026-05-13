import os
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from datetime import datetime, timedelta
from fastapi import HTTPException
from pathlib import Path

# Create a serializer with a secret key
SECRET_SIGN_KEY_FOR_URL = os.getenv("SECRET_SIGN_KEY_FOR_URL")
serializer = URLSafeTimedSerializer(SECRET_SIGN_KEY_FOR_URL) 

async def generate_signed_url(file_path : str, user_id : int, user_role : str, doc_id : int, expiration_seconds : int = 3600):
    """
    Generate a signed URL for secure file access
    
    Args:
        file_path: The actual path to the file on disk or storage
        user_id: ID of the user requesting access
        doc_id: Document ID
        expiration_seconds: How long the URL is valid (default 1 hour)
    
    Returns:
        Signed URL string
    """
    # Create payload with file info and expiration
    payload = {
        "file_path" : file_path,
        "user_id" : user_id,
        "user_role" : user_role,
        "doc_id" : doc_id,
        "original_filename" : Path(file_path).name,
        "exp" : (datetime.now() + timedelta(seconds = expiration_seconds)).isoformat()
    }
    
    # Generate signature
    token = serializer.dumps(payload)
    
    # Create the signed URL
    signed_url = f"/default/view?token={token}"
    
    return signed_url

async def verify_signed_url(token : str):
    """
    Verify a signed URL and return the file path
    
    Args:
        token: The signature token from URL
        user_id: Current authenticated user ID
    
    Returns:
        File path if valid
    
    Raises:
        HTTPException if invalid or expired
    """
    try:
        # Decode and verify the token (max_age checks expiration)
        payload = serializer.loads(token, max_age = 3600)

        if payload["exp"] < datetime.now().isoformat():
            raise HTTPException(status_code = 401, detail = "Download link has expired")
        # # Verify this user is the one who requested the URL
        # if payload["user_id"] != user_id:
        #     raise HTTPException(status_code = 403, detail = "Access denied")
        
        
        return True
        
    except SignatureExpired:
        raise HTTPException(status_code = 401, detail = "Download link has expired")
    except BadSignature:
        raise HTTPException(status_code = 401, detail = "Invalid download link")

async def generate_secure_download_url(document, user_id : int, base_url : str = ""):
    """
    Generate a complete signed URL for frontend use
    """
    token_data = {
        "doc_id" : document.id,
        "user_id" : user_id,
        "file_path" : document.document_path,
        "filename" : document.filename or "document",
        "expires_at" : (datetime.utcnow() + timedelta(hours=1)).isoformat()
    }
    
    token = serializer.dumps(token_data)
    
    return {
        "url" : f"{base_url}/api/secure-download/{token}",
        "expires_in" : 3600,
        "expires_at" : token_data["expires_at"],
        "filename" : token_data["filename"]
    }