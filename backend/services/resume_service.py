import io
from pypdf import PdfReader
import docx

def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extracts plain text from PDF or DOCX files."""
    text = ""
    try:
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                text += page.extract_text() + "\n"
        elif filename.lower().endswith((".doc", ".docx")):
            doc = docx.Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                text += para.text + "\n"
    except Exception as e:
        print(f"❌ Error extracting text from {filename}: {e}")
    
    return text.strip()