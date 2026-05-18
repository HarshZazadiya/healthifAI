import datetime
import os
import shutil
import pdfplumber
from pathlib import Path
from logs.logging import logger
from AI.AI_models import embeddings
from langchain_core.tools import tool
import chromadb
from chromadb.utils import embedding_functions
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pdf2image import convert_from_path
import base64
import openai, io

# ============================================================
# CONFIGURATION
# ============================================================
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "documents"
VECTOR_STORE_DIR = BASE_DIR / "vector_store"
FAISS_INDEX_PATH = VECTOR_STORE_DIR / "faiss_index"

VECTOR_STORE_DIR.mkdir(exist_ok = True)
UPLOAD_DIR.mkdir(exist_ok = True)

# Global vector store
vector_store = None

# ============================================================
# CLEANUP
# ============================================================

def cleanup_vector_store():
    """Delete FAISS index when app closes"""
    logger.info("\n=~~~ Cleaning up vector storec ~~~")
    if FAISS_INDEX_PATH.exists():
        try:
            shutil.rmtree(FAISS_INDEX_PATH)
            logger.info("============= Deleted FAISS index =============")
        except Exception as e:
            logger.info(f"Error deleting: {e}")

def is_pdf_scannable(file_path: str, min_chars: int = 50) -> bool:
    with pdfplumber.open(file_path) as pdf:
        total_text = ""
        for page in pdf.pages[:3]:      # check first few pages
            total_text += page.extract_text() or ""
    return len(total_text.strip()) >= min_chars

def extract_text_from_scannable_pdf(file_path: str) -> list[dict]:
    pages = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                pages.append({"page_number": i+1, "text": text})
    return pages


def pdf_to_images(file_path: str) -> list[bytes]:
    images = convert_from_path(file_path, dpi=200)
    # Convert each PIL image to bytes (PNG) for the API
    img_bytes_list = []
    for img in images:
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        img_bytes_list.append(buf.getvalue())
    return img_bytes_list

def extract_text_from_image(image_bytes: bytes, page_num: int) -> str:
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract all visible text from this image, preserving paragraphs and layout as much as possible. Return only the extracted text, nothing else."},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}}
                ]
            }
        ],
        temperature=0
    )
    return response.choices[0].message.content

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=["\n\n", "\n", ".", " ", ""]
)

def create_chunks(pages: list[dict], source_file: str, extraction_method: str) -> list[dict]:
    chunks_meta = []
    for page in pages:
        page_text = page["text"]
        if not page_text.strip():
            continue
        page_chunks = splitter.split_text(page_text)
        for i, chunk in enumerate(page_chunks):
            chunks_meta.append({
                "text": chunk,
                "metadata": {
                    "source": source_file,           # original filename or doc_id
                    "page_number": page["page_number"],
                    "chunk_index": i,
                    "extraction_method": extraction_method,  # "direct" or "llm_vision"
                    "file_type": "pdf" if source_file.endswith(".pdf") else "image"
                }
            })
    return chunks_meta

client = chromadb.PersistentClient(path="./chroma_db")
embed_fn = embedding_functions.OpenAIEmbeddingFunction(
    api_key="...", model_name="text-embedding-3-small"
)
collection = client.get_or_create_collection("documents", embedding_function=embed_fn)

def store_chunks(chunks_meta: list[dict]):
    ids = []
    docs = []
    metadatas = []
    for idx, chunk in enumerate(chunks_meta):
        chunk_id = f"{chunk['metadata']['source']}_p{chunk['metadata']['page_number']}_c{chunk['metadata']['chunk_index']}"
        ids.append(chunk_id)
        docs.append(chunk["text"])
        metadatas.append(chunk["metadata"])
    collection.add(ids=ids, documents=docs, metadatas=metadatas)

def retrieve(query: str, source_filter: str = None, top_k: int = 5):
    if source_filter:
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
            where={"source": {"$eq": source_filter}}
        )
    else:
        results = collection.query(
            query_texts=[query],
            n_results=top_k
        )
    # results contain ids, documents, metadatas, distances
    return results

def generate_answer(user_query: str, retrieved_chunks: list[dict]):
    context = ""
    for chunk in retrieved_chunks:
        src = chunk["metadata"]["source"]
        page = chunk["metadata"]["page_number"]
        context += f"[Source: {src}, page {page}]\n{chunk['text']}\n\n"
    
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a helpful assistant. Answer the question using only the provided context. If you can't answer, say so. Always cite the source file and page number."},
            {"role": "user", "content": f"Context:\n{context}\nQuestion: {user_query}"}
        ]
    )
    return response.choices[0].message.content

def process_file(file_path: str):
    # Generate a unique doc_id (e.g., UUID or filename + timestamp)
    doc_id = f"{os.path.basename(file_path)}_{int(datetime.now())}"
    
    if file_path.lower().endswith(".pdf"):
        if is_pdf_scannable(file_path):
            pages = extract_text_from_scannable_pdf(file_path)
            extraction_method = "direct"
        else:
            images = pdf_to_images(file_path)
            pages = []
            for i, img_bytes in enumerate(images):
                text = extract_text_from_image(img_bytes, i+1)
                pages.append({"page_number": i+1, "text": text})
            extraction_method = "llm_vision"
    else:   # image file
        with open(file_path, "rb") as f:
            img_bytes = f.read()
        text = extract_text_from_image(img_bytes, 1)
        pages = [{"page_number": 1, "text": text}]
        extraction_method = "llm_vision"
    
    # Chunk and store
    chunks = create_chunks(pages, source_file=doc_id, extraction_method=extraction_method)
    store_chunks(chunks)
    return doc_id