from fastapi import Request
from datetime import datetime
from logs.logging import logger

async def log_middleware(request : Request, call_next):
    start_time = datetime.now()
    response = await call_next(request)
    log_dict = {
        "Incoming request" : f"{request.method} {request.url.path}",
        "query_params" : dict(request.query_params),
        "response_status" : response.status_code,
        "response_time" : datetime.now() - start_time
    }
    logger.info(f"Request details : {log_dict}")

    return response