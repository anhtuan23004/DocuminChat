import pandas as pd
import pdfplumber

def load_file(file, file_type):
    if file_type == "csv":
        return pd.read_csv(file)
    elif file_type == "json":
        return pd.read_json(file)
    elif file_type == "xlsx":
        return pd.read_excel(file)
    elif file_type == "pdf":
        return extract_text_from_pdf(file)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
    
# Xu ly du lieu file PDF
def extract_text_from_pdf(file):
    """
    Extract text from a PDF file and return it as a single string.
    """
    with pdfplumber.open(file) as pdf:
        pages = [page.extract_text() for page in pdf.pages]
    # Combine all pages into a single string
    full_text = "\n".join([page for page in pages if page])
    return full_text