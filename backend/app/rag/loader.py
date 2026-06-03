"""Extract text from a PDF, one entry per page (page numbers power citations).

Primary extraction uses pypdf. Pages that come back empty — i.e. scanned or
image-only pages, which is common for exam papers — are rendered to an image with
PyMuPDF and run through RapidOCR. The OCR engine and heavy imports are loaded
lazily, so text-based PDFs pay no OCR cost.
"""
from pypdf import PdfReader

# A page with fewer than this many characters of extracted text is treated as
# scanned and sent to OCR.
_MIN_CHARS = 20
_ocr_engine = None  # lazy RapidOCR singleton


def _get_ocr():
    global _ocr_engine
    if _ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr_engine = RapidOCR()
    return _ocr_engine


def _ocr_pages(path: str, page_numbers):
    """OCR the given 1-based page numbers. Returns {page_no: text}."""
    import fitz  # PyMuPDF
    import cv2
    import numpy as np

    ocr = _get_ocr()
    out = {}
    doc = fitz.open(path)
    try:
        for pno in page_numbers:
            pix = doc[pno - 1].get_pixmap(dpi=200)  # higher dpi -> better OCR
            img = cv2.imdecode(np.frombuffer(pix.tobytes("png"), np.uint8), cv2.IMREAD_COLOR)
            result, _ = ocr(img)
            out[pno] = " ".join(line[1] for line in result) if result else ""
    finally:
        doc.close()
    return out


def extract_pages(path: str):
    reader = PdfReader(path)
    pages = [{"page": i + 1, "text": (pg.extract_text() or "")}
             for i, pg in enumerate(reader.pages)]

    # Pages with no real text layer -> OCR fallback (scanned documents).
    needs_ocr = [p["page"] for p in pages if len(p["text"].strip()) < _MIN_CHARS]
    if needs_ocr:
        ocr_text = _ocr_pages(path, needs_ocr)
        for p in pages:
            recovered = ocr_text.get(p["page"], "")
            if recovered.strip():
                p["text"] = recovered
    return pages
