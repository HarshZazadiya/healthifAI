import os
from logs.logging import logger
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings

# ============================================================
# MAIN LLM
# ============================================================

logger.info("Initializing GPT-oss-120b via Groq...")
try : 
    llm = ChatGroq(
        model = "llama-3.3-70b-versatile",
        # model = "openai/gpt-oss-120b",
        temperature = 0,
        max_tokens = 2048,
        groq_api_key = os.getenv("GROQ_API_KEY")
    )
except Exception as e:
    logger.error(f"Error initializing GPT-oss-120b via Groq: {e}")
    raise

# ============================================================
# EMBEDDINGS
# ============================================================

logger.info("Initializing HuggingFace Embeddings...")
try:
    embeddings = HuggingFaceEmbeddings(
        model_name = "sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
        encode_kwargs = {"normalize_embeddings": True}
    )
except Exception as e :
    logger.error(f"Error initializing GPT-oss-120b via Hugging Face : {e}")
    raise

# ============================================================
# EXTRACTOR LLM SETUP
# ============================================================

logger.info("Initializing Extractor LLM...")
try:
    extractor_llm = ChatGroq(
        model = "llama-3.3-70b-versatile",
        temperature = 0,
        max_tokens = 2048,
        groq_api_key = os.getenv("GROQ_API_KEY")
    )
except Exception as e :
    logger.error(f"Error initializing GPT-oss-120b via Groq : {e}")
    raise

# ============================================================
# SUMMARIZER LLM SETUP
# ============================================================

logger.info("Initializing Summarizer LLM...")
try:
    summary_llm = ChatGroq(
        model = "llama-3.3-70b-versatile",
        temperature = 0,
        max_tokens = 2048,
        groq_api_key = os.getenv("GROQ_API_KEY")
    )
except Exception as e :
    logger.error(f"Error initializing GPT-oss-120b via Groq : {e}")
    raise

# ============================================================
# OCR/TEXT EXTRACTOR vLLM
# ============================================================

logger.info("Initializing vLLM...")
try:
    text_extractor_llm = ChatGroq(
        model = "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature = 0,
        max_tokens = 2048,
        groq_api_key = os.getenv("GROQ_API_KEY")
    )
except Exception as e :
    logger.error(f"Error initializing GPT-oss-120b via Groq : {e}")
    raise
