import mimetypes
import PyPDF2
from PIL import Image
from models import Documents
from logs.logging import logger
from database import SessionLocal

SCANNABLE_MIMES = {
    'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/gif',
    'application/pdf'
}

def guess_mime_from_bytes(file_path: str) -> str:
    try:
        with open(file_path, 'rb') as f:
            header = f.read(16)
        if header.startswith(b'%PDF'):
            return 'application/pdf'
        elif header.startswith(b'\xff\xd8\xff'):
            return 'image/jpeg'
        elif header.startswith(b'\x89PNG\r\n\x1a\n'):
            return 'image/png'
        elif header.startswith(b'II*\x00') or header.startswith(b'MM\x00*'):
            return 'image/tiff'
        elif header.startswith(b'BM'):
            return 'image/bmp'
        elif header.startswith(b'GIF87a') or header.startswith(b'GIF89a'):
            return 'image/gif'
    except Exception as e:
        logger.error(f"Error reading magic bytes: {e}")
    return None

def check_scannable(file_path: str):
    """
    Background task: determines if a file is scannable and updates the database.
    """
    db = SessionLocal()
    try:
        # 1) MIME check
        mime = guess_mime_from_bytes(file_path)
        if not mime:
            mime, _ = mimetypes.guess_type(file_path)
            
        logger.info(f"MIME: {mime}")
        if mime not in SCANNABLE_MIMES:
            db.query(Documents).filter(Documents.document_path == file_path).update({"doc_class": "NOT SCANNABLE"})
            db.commit()
            return

        # 2) Image integrity
        if mime.startswith('image/'):
            try:
                with Image.open(file_path) as img:
                    img.verify()
                db.query(Documents).filter(Documents.document_path == file_path).update({"doc_class": "SCANNABLE"})
            except Exception:
                db.query(Documents).filter(Documents.document_path == file_path).update({"doc_class": "NOT SCANNABLE"})
            db.commit()
            return

        # 3) PDF integrity
        if mime == 'application/pdf':
            try:
                with open(file_path, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    if len(reader.pages) > 0:
                        db.query(Documents).filter(Documents.document_path == file_path).update({"doc_class": "SCANNABLE"})
                    else:
                        db.query(Documents).filter(Documents.document_path == file_path).update({"doc_class": "NOT SCANNABLE"})
            except Exception:
                db.query(Documents).filter(Documents.document_path == file_path).update({"doc_class": "NOT SCANNABLE"})
            db.commit()
            return

        # Fallback
        db.query(Documents).filter(Documents.document_path == file_path).update({"doc_class": "NOT SCANNABLE"})
        db.commit()

    finally:
        db.close() 