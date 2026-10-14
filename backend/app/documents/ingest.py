from pathlib import Path

from pypdf import PdfReader


def extract(path: str) -> list[tuple[int, str]]:
    """Bounded text extraction. OCR and complex layouts are separate future adapters."""
    file = Path(path)
    pages = []
    if file.suffix == ".txt":
        text = file.read_text(encoding="utf-8")
        if len(text) > 2_000_000:
            raise ValueError("Tài liệu vượt giới hạn 2 triệu ký tự.")
        pages = [(1, text)]
    else:
        reader = PdfReader(file)
        if reader.is_encrypted:
            raise ValueError("PDF có mật khẩu chưa được hỗ trợ.")
        if len(reader.pages) > 100:
            raise ValueError("Khung hiện tại hỗ trợ tối đa 100 trang PDF.")
        total = 0
        for index, page in enumerate(reader.pages, start=1):
            contents = page.get_contents()
            if contents and len(contents.get_data()) > 10_000_000:
                raise ValueError("Trang PDF quá lớn để xử lý trong khung hiện tại.")
            text = page.extract_text() or ""
            total += len(text)
            if total > 2_000_000:
                raise ValueError("Tài liệu vượt giới hạn 2 triệu ký tự.")
            pages.append((index, text))
    chunks = []
    for page, text in pages:
        text = text.replace("\x00", "").strip()
        for start in range(0, len(text), 1000):
            chunk = text[start : start + 1200].strip()
            if chunk:
                chunks.append((page, chunk))
    if not chunks:
        raise ValueError("Không tìm thấy văn bản. PDF scan cần module OCR.")
    return chunks
