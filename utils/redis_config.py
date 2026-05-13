import os
from redis.asyncio import Redis
from logs.logging import logger

REDIS_URL = os.getenv("REDIS_URL")

def configure_redis():
    global redis_client
    if REDIS_URL:
        try:
            redis_client = Redis.from_url(REDIS_URL, decode_responses = True)
            logger.info(f"Redis configured at {REDIS_URL}")
        except Exception as e:
            logger.info(f"Redis disabled: {e}\n")
            logger.info("="*50)
            redis_client = None
    else:
        redis_client = None

logger.info("Configuring Redis...")
configure_redis()