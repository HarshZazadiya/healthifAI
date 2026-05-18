# import os
# import magic
# from PIL import Image
# import PyPDF2
# from typing import Tuple, Optional

# def is_scannable(file_path: str, max_size_mb: int = 10) -> Tuple[bool, Optional[str]]:
#     """
#     Check if a file is scannable (valid image or PDF, not corrupt, within size limit).
    
#     Args:
#         file_path: Path to the file
#         max_size_mb: Maximum allowed file size in MB
    
#     Returns:
#         (is_scannable, error_message)
#     """
#     # Check if file exists
#     if not os.path.exists(file_path):
#         return False, "File does not exist"
    
#     # Check file size
#     file_size = os.path.getsize(file_path)
#     max_size_bytes = max_size_mb * 1024 * 1024
#     if file_size > max_size_bytes:
#         return False, f"File exceeds {max_size_mb} MB limit"
#     if file_size == 0:
#         return False, "File is empty"
    
#     # Detect MIME type using python-magic
#     try:
#         mime = magic.from_file(file_path, mime=True)
#     except Exception as e:
#         return False, f"Could not detect file type: {e}"
    
#     # Supported MIME types
#     supported_mimes = {
#         'application/pdf': 'pdf',
#         'image/jpeg': 'jpeg',
#         'image/png': 'png',
#         'image/tiff': 'tiff',
#         'image/bmp': 'bmp',
#         'image/gif': 'gif',
#         'image/webp': 'webp',
#         'image/heic': 'heic',  # if you have appropriate libs
#     }
    
#     if mime not in supported_mimes:
#         return False, f"Unsupported file type: {mime}. Allowed: {', '.join(supported_mimes.keys())}"
    
#     # Validate file integrity based on type
#     if mime == 'application/pdf':
#         try:
#             with open(file_path, 'rb') as f:
#                 reader = PyPDF2.PdfReader(f)
#                 # Check if PDF has at least one page
#                 if len(reader.pages) == 0:
#                     return False, "PDF has no pages"
#                 # Optionally check for encryption
#                 if reader.is_encrypted:
#                     return False, "Encrypted PDF cannot be scanned"
#         except PyPDF2.PdfReadError as e:
#             return False, f"Corrupt PDF: {e}"
#         except Exception as e:
#             return False, f"PDF validation error: {e}"
    
#     elif mime.startswith('image/'):
#         try:
#             with Image.open(file_path) as img:
#                 img.verify()  # Verifies integrity
#                 # Reopen after verify (required)
#                 img = Image.open(file_path)
#                 # Optionally check dimensions
#                 if img.width == 0 or img.height == 0:
#                     return False, "Image has zero dimensions"
#         except Exception as e:
#             return False, f"Corrupt or invalid image: {e}"
    
#     return True, None

# # Example usage
# if __name__ == "__main__":
#     test_file = "sample.pdf"
#     scannable, error = is_scannable(test_file)
#     if scannable:
#         print(f"✅ {test_file} is scannable.")
#     else:
#         print(f"❌ {test_file} is NOT scannable: {error}")


