import os
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings

# ============================================================
# LLM - Kimi K2 via Groq
# ============================================================

print("🔄 Initializing llama-3.3-70B via Groq...")
llm = ChatGroq(
    # model = "openai/gpt-oss-120b",
    model = "llama-3.3-70b-versatile",
    temperature = 0,
    max_tokens = 2048,
    groq_api_key = os.getenv("GROQ_API_KEY")
)

# ============================================================
# EMBEDDINGS - HuggingFace
# ============================================================
print("🔄 Initializing HuggingFace Embeddings...")
embeddings = HuggingFaceEmbeddings(
    model_name = "sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs = {"device": "cpu"},
    encode_kwargs = {"normalize_embeddings": True}
)
print("✅ LLM and Embeddings ready")