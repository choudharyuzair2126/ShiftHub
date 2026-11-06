import io
import re
from pypdf import PdfReader
import docx

def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extracts plain text from PDF or DOCX files and cleans it."""
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
    
    # Clean up common PDF extraction artifacts (like \(4+\))
    text = text.replace("\(", "(").replace("\)", ")")
    text = re.sub(r'\n{3,}', '\n\n', text) # Replace 3+ newlines with 2
    text = re.sub(r'[ \t]{2,}', ' ', text) # Replace multiple spaces with 1
    
    return text.strip()