import os
from pathlib import Path
import pdfplumber
import PdfReader
import cv2
import numpy as np
from pdf2image import convert_from_path
from typing import Tuple, Dict, Optional, Union
import tempfile

# ============================================================
# Scannability Checker
# ============================================================

class ScannabilityChecker:
    """Checks if a document can be read by traditional methods or needs LLM."""
    
    def __init__(
        self,
        min_sharpness: float = 100.0,      # Laplacian variance for blur detection
        min_brightness: int = 40,           # Minimum mean brightness
        max_brightness: int = 240,          # Maximum mean brightness (overexposed)
        min_contrast: float = 30.0,         # RMS contrast threshold
        min_resolution_width: int = 500,    # Minimum width in pixels
        min_resolution_height: int = 500,   # Minimum height in pixels
        skew_threshold: float = 10.0,       # Maximum skew angle in degrees
        max_noise: float = 25.0,            # Maximum noise level
        min_text_percentage: float = 0.5,   # Minimum text content percentage (for PDFs)
    ):
        self.min_sharpness = min_sharpness
        self.min_brightness = min_brightness
        self.max_brightness = max_brightness
        self.min_contrast = min_contrast
        self.min_resolution_width = min_resolution_width
        self.min_resolution_height = min_resolution_height
        self.skew_threshold = skew_threshold
        self.max_noise = max_noise
        self.min_text_percentage = min_text_percentage
    
    def check_image(self, image_path: str) -> Dict:
        """Check if an image is scannable by traditional methods."""
        if not os.path.exists(image_path):
            return {"error": f"File not found: {image_path}", "is_scannable": False}
        
        try:
            image = cv2.imread(image_path)
            if image is None:
                return {"error": "Could not read image", "is_scannable": False}
            
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            metrics = {}
            issues = []
            
            # 1. Resolution
            height, width = image.shape[:2]
            metrics["resolution"] = f"{width}x{height}"
            if width < self.min_resolution_width or height < self.min_resolution_height:
                issues.append("low_resolution")
            
            # 2. Sharpness (Laplacian variance)
            sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
            metrics["sharpness"] = round(sharpness, 1)
            if sharpness < self.min_sharpness:
                issues.append("blurry")
            
            # 3. Brightness
            mean_brightness = np.mean(gray)
            metrics["brightness"] = round(mean_brightness, 1)
            if mean_brightness < self.min_brightness:
                issues.append("too_dark")
            elif mean_brightness > self.max_brightness:
                issues.append("overexposed")
            
            # 4. Contrast (RMS)
            contrast = np.std(gray)
            metrics["contrast"] = round(contrast, 1)
            if contrast < self.min_contrast:
                issues.append("low_contrast")
            
            # 5. Skew detection
            skew_angle = self._detect_skew(gray)
            metrics["skew_angle"] = round(skew_angle, 1)
            if abs(skew_angle) > self.skew_threshold:
                issues.append("skewed")
            
            # 6. Noise estimation
            noise = self._estimate_noise(gray)
            metrics["noise"] = round(noise, 1)
            if noise > self.max_noise:
                issues.append("noisy")
            
            # Determine scannability
            is_scannable = len(issues) == 0
            
            return {
                "is_scannable": is_scannable,
                "issues": issues if issues else ["none"],
                "metrics": metrics,
                "needs_llm": not is_scannable,
                "reason": self._get_reason(is_scannable, issues)
            }
            
        except Exception as e:
            return {"error": str(e), "is_scannable": False, "needs_llm": True}
    
    def check_pdf(self, pdf_path: str) -> Dict:
        """Check if a PDF is scannable (has extractable text and clear images)."""
        if not os.path.exists(pdf_path):
            return {"error": f"File not found: {pdf_path}", "is_scannable": False}
        
        try:
            # First check if PDF has extractable text
            text_extractable = self._has_extractable_text(pdf_path)
            
            # Convert first few pages to images for quality check
            try:
                images = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=3)
            except Exception:
                # If conversion fails, rely only on text extraction
                return {
                    "is_scannable": text_extractable,
                    "issues": ["none"] if text_extractable else ["no_text"],
                    "needs_llm": not text_extractable,
                    "reason": "PDF has extractable text" if text_extractable else "No extractable text found, needs LLM"
                }
            
            if not images:
                return {
                    "is_scannable": text_extractable,
                    "issues": ["no_pages"] if not text_extractable else ["none"],
                    "needs_llm": not text_extractable,
                    "reason": "Empty PDF" if not text_extractable else "PDF has extractable text"
                }
            
            # Check quality of each page
            page_results = []
            all_issues = set()
            
            for i, image in enumerate(images):
                temp_path = os.path.join(tempfile.gettempdir(), f"pdf_check_page_{i}.png")
                image.save(temp_path, "PNG")
                
                result = self.check_image(temp_path)
                page_results.append(result)
                
                if not result["is_scannable"]:
                    for issue in result.get("issues", []):
                        if issue != "none":
                            all_issues.add(issue)
                
                # Cleanup
                try:
                    os.remove(temp_path)
                except:
                    pass
            
            # Overall verdict
            images_clear = all(len(r.get("issues", [])) == 1 and r["issues"][0] == "none" for r in page_results)
            
            is_scannable = text_extractable and images_clear
            
            return {
                "is_scannable": is_scannable,
                "has_extractable_text": text_extractable,
                "images_clear": images_clear,
                "issues": list(all_issues) if all_issues else ["none"],
                "needs_llm": not is_scannable,
                "reason": self._get_pdf_reason(is_scannable, text_extractable, images_clear, all_issues),
                "pages_checked": len(images)
            }
            
        except Exception as e:
            return {"error": str(e), "is_scannable": False, "needs_llm": True}
    
    def _has_extractable_text(self, pdf_path: str) -> bool:
        """Check if PDF has extractable text."""
        try:
            reader = PdfReader(pdf_path)
            total_text = ""
            for page in reader.pages[:3]:  # Check first 3 pages
                text = page.extract_text()
                if text:
                    total_text += text
            
            # Calculate text density
            if len(total_text.strip()) > 50:  # At least 50 chars of text
                return True
            return False
        except Exception:
            return False
    
    def _detect_skew(self, gray_image: np.ndarray) -> float:
        """Detect skew angle of text in image."""
        try:
            _, thresh = cv2.threshold(gray_image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            coords = np.column_stack(np.where(thresh > 0))
            
            if len(coords) < 100:
                return 0.0
            
            rect = cv2.minAreaRect(coords)
            angle = rect[-1]
            
            if angle < -45:
                angle = 90 + angle
            
            return angle
        except Exception:
            return 0.0
    
    def _estimate_noise(self, gray_image: np.ndarray) -> float:
        """Estimate noise level."""
        try:
            denoised = cv2.medianBlur(gray_image, 5)
            diff = cv2.absdiff(gray_image, denoised)
            return float(np.mean(diff))
        except Exception:
            return 0.0
    
    def _get_reason(self, is_scannable: bool, issues: list) -> str:
        """Generate human-readable reason."""
        if is_scannable:
            return "Document is clear and scannable - use read_file"
        
        reason_map = {
            "low_resolution": "Low resolution",
            "blurry": "Blurry/unfocused",
            "too_dark": "Too dark/underexposed",
            "overexposed": "Overexposed/too bright",
            "low_contrast": "Low contrast",
            "skewed": "Significantly skewed",
            "noisy": "High noise/grain",
        }
        
        reasons = [reason_map.get(i, i) for i in issues if i != "none"]
        
        if reasons:
            return "Document has quality issues: " + ", ".join(reasons) + ". Use LLM for better results."
        return "Document quality issues detected - use LLM"
    
    def _get_pdf_reason(self, is_scannable: bool, has_text: bool, images_clear: bool, issues: set) -> str:
        """Generate reason for PDF scannability."""
        if is_scannable:
            return "PDF has extractable text and clear images - use read_file"
        
        reasons = []
        if not has_text:
            reasons.append("No extractable text (scanned image PDF)")
        if not images_clear and issues:
            issue_list = list(issues - {"none"})
            if issue_list:
                reasons.append(f"Image quality issues: {', '.join(issue_list)}")
        
        return " | ".join(reasons) + ". Recommend using LLM for reading."


# Global checker instance
_checker = ScannabilityChecker()


def _get_file_path(filename: str) -> Path:
    """Resolve file path with workspace."""
    path = WORKSPACE / filename
    if not str(path.resolve()).startswith(str(WORKSPACE.resolve())):
        raise ValueError("Access denied - file outside workspace")
    return path


@mcp.tool()
def check_scannability(filename: str) -> str:
    """
    Check if a document (PDF or image) is scannable by traditional methods.
    
    Returns a report indicating whether to use read_file or send to LLM.
    
    Args:
        filename: Name of the file in the workspace
    
    Returns:
        Scannability report with recommendation
    """
    try:
        path = _get_file_path(filename)
        
        if not path.exists():
            return f"❌ Error: File '{filename}' not found in {WORKSPACE}"
        
        ext = path.suffix.lower()
        
        if ext == '.pdf':
            result = _checker.check_pdf(str(path))
        elif ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp']:
            result = _checker.check_image(str(path))
        else:
            return f"⚠️ Unsupported file type: {ext}. Supported: PDF, PNG, JPG, TIFF, BMP"
        
        if "error" in result:
            return f"❌ Error checking file: {result['error']}"
        
        # Build response
        response = f"📋 Scannability Report: {filename}\n"
        response += "=" * 50 + "\n\n"
        
        is_scannable = result["is_scannable"]
        needs_llm = result.get("needs_llm", not is_scannable)
        
        if is_scannable:
            response += "✅ SCANNABLE - Use read_file\n\n"
        else:
            response += "❌ NOT SCANNABLE - Use LLM\n\n"
        
        response += f"📝 Reason: {result.get('reason', 'N/A')}\n\n"
        
        if "has_extractable_text" in result:
            response += f"📄 Has extractable text: {'Yes' if result['has_extractable_text'] else 'No'}\n"
            response += f"🖼️ Images clear: {'Yes' if result['images_clear'] else 'No'}\n"
            response += f"📑 Pages checked: {result.get('pages_checked', 'N/A')}\n"
        
        if "issues" in result:
            response += f"\n🔍 Issues detected: {', '.join(result['issues'])}\n"
        
        if "metrics" in result:
            m = result["metrics"]
            response += "\n📊 Quality Metrics:\n"
            for key, value in m.items():
                response += f"  • {key}: {value}\n"
        
        response += "\n" + "=" * 50 + "\n"
        response += "💡 Recommendation:\n"
        
        if is_scannable:
            response += f"  → Use read_file('{filename}') for text extraction\n"
        else:
            response += f"  → Use LLM to process this document\n"
            response += f"  → Pass the file content to an LLM with vision capabilities\n"
        
        return response
        
    except Exception as e:
        return f"❌ Error: {e}"


@mcp.tool()
def read_or_llm(filename: str) -> str:
    """
    Smart document reader: uses read_file if scannable, otherwise 
    returns a message indicating LLM should be used.
    
    Args:
        filename: Name of the file in the workspace
    
    Returns:
        File content if scannable, or LLM recommendation
    """
    try:
        path = _get_file_path(filename)
        
        if not path.exists():
            return f"❌ Error: File '{filename}' not found"
        
        # Check scannability
        ext = path.suffix.lower()
        
        if ext == '.pdf':
            result = _checker.check_pdf(str(path))
        elif ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp']:
            result = _checker.check_image(str(path))
        else:
            # For other file types, just read normally
            return read_file(filename)
        
        if "error" in result:
            return read_file(filename)  # Fallback to normal read
        
        if result["is_scannable"]:
            # Use traditional reading
            content = read_file(filename)
            return f"✅ Read via traditional method:\n\n{content}"
        else:
            # Needs LLM
            response = f"⚠️ DOCUMENT NEEDS LLM PROCESSING\n"
            response += "=" * 50 + "\n"
            response += f"File: {filename}\n"
            response += f"Reason: {result.get('reason', 'Quality issues detected')}\n\n"
            response += "📋 To process this file with an LLM:\n"
            response += "  1. Read the file as base64\n"
            response += "  2. Pass it to a vision-capable LLM\n"
            response += "  3. Or use an OCR service first, then process the text\n\n"
            
            # Include the base64 content for convenience
            try:
                file_bytes = path.read_bytes()
                b64_content = base64.b64encode(file_bytes).decode('utf-8')
                response += f"📦 Base64 content ({len(b64_content)} chars):\n"
                response += b64_content[:500] + "...[truncated]\n"
            except Exception as e:
                response += f"❌ Could not encode file: {e}\n"
            
            return response
        
    except Exception as e:
        return f"❌ Error: {e}"