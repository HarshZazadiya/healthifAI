import magic
import PyPDF2
from PIL import Image
from models import Documents
from logs.logging import logger
from database import SessionLocal

SCANNABLE_MIMES = {
    'image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/gif',
    'application/pdf'
}

def check_scannable(file_path: str):
    """
    Background task: determines if a file is scannable and updates the database.
    """
    db = SessionLocal()
    try:
        # 1) MIME check
        mime = magic.from_file(file_path, mime=True)
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