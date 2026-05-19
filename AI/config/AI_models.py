import os
from logs.logging import logger
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings

# ============================================================
# MAIN LLM
# ============================================================

logger.info("Initializing llama-3.3-70B via Groq...")
llm = ChatGroq(
    # model = "openai/gpt-oss-120b",
    model = "llama-3.3-70b-versatile",
    temperature = 0,
    max_tokens = 2048,
    groq_api_key = os.getenv("GROQ_API_KEY")
)

# ============================================================
# EMBEDDINGS
# ============================================================

logger.info("Initializing HuggingFace Embeddings...")
embeddings = HuggingFaceEmbeddings(
    model_name = "sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs = {"device": "cpu"},
    encode_kwargs = {"normalize_embeddings": True}
)

# ============================================================
# EXTRACTOR LLM SETUP
# ============================================================

logger.info("Initializing Extractor LLM...")
extractor_llm = ChatGroq(
    model = "llama-3.3-70b-versatile",
    temperature = 0,
    max_tokens = 2048,
    groq_api_key = os.getenv("GROQ_API_KEY")
)

# ============================================================
# SUMMARIZER LLM SETUP
# ============================================================

logger.info("Initializing Summarizer LLM...")
summary_llm = ChatGroq(
    model = "llama-3.3-70b-versatile",
    temperature = 0,
    max_tokens = 2048,
    groq_api_key = os.getenv("GROQ_API_KEY")
)

logger.info("LLM and Embeddings ready")