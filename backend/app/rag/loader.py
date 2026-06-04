"""Extract text from an uploaded document, one entry per page (page numbers power
citations).

PDFs: primary extraction uses pypdf. Pages that come back empty — i.e. scanned or
image-only pages, common for exam papers — are rendered to an image with PyMuPDF
and run through RapidOCR.

Images (a photo of notes, a screenshot): OCR'd directly as a single page.

The OCR engine and heavy imports are loaded lazily, so text-based PDFs pay no OCR
cost.
"""
import os
from pypdf import PdfReader

# A page with fewer than this many characters of extracted text is treated as
# scanned and sent to OCR.
_MIN_CHARS = 20
# Raw image uploads we OCR directly (no PDF text layer to try first).
_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
_ocr_engine = None  # lazy RapidOCR singleton


def _get_ocr():
    global _ocr_engine
    if _ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr_engine = RapidOCR()
    return _ocr_engine


def _ocr_decoded(img) -> str:
    """Run OCR on a decoded image (numpy array); join detected lines into text."""
    result, _ = _get_ocr()(img)
    return " ".join(line[1] for line in result) if result else ""


def _ocr_image_file(path: str) -> str:
    """OCR a raw image file (jpg/png/...). Reads bytes then decodes so non-ASCII
    paths work; returns "" if the file isn't a decodable image."""
    import cv2
    import numpy as np

    with open(path, "rb") as f:
        data = f.read()
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return ""
    return _ocr_decoded(img)


def _ocr_pages(path: str, page_numbers):
    """OCR the given 1-based PDF page numbers. Returns {page_no: text}."""
    import fitz  # PyMuPDF
    import cv2
    import numpy as np

    out = {}
    doc = fitz.open(path)
    try:
        for pno in page_numbers:
            pix = doc[pno - 1].get_pixmap(dpi=200)  # higher dpi -> better OCR
            img = cv2.imdecode(np.frombuffer(pix.tobytes("png"), np.uint8), cv2.IMREAD_COLOR)
            out[pno] = _ocr_decoded(img)
    finally:
        doc.close()
    return out


def extract_pages(path: str):
    # Raw image upload (e.g. a photo of notes) -> OCR directly as a single page.
    if os.path.splitext(path)[1].lower() in _IMAGE_EXTS:
        return [{"page": 1, "text": _ocr_image_file(path)}]

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
