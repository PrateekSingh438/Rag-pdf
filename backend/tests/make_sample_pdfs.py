"""Generate small, text-extractable sample PDFs for local testing (notes + exam).

Pure standard-library PDF writer — no external deps — so it runs even before the
ML libraries finish installing. Produces fixtures under tests/fixtures/ that the
ingestion, retrieval, and generation phases reuse.
"""
import os

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _escape(s: str) -> str:
    return s.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def _content_stream(lines):
    """Build a page content stream that prints each line top-to-bottom."""
    out = ["BT", "/F1 12 Tf", "72 720 Td", "14 TL"]
    for ln in lines:
        out.append(f"({_escape(ln)}) Tj")
        out.append("T*")  # move to next line (uses leading set by TL)
    out.append("ET")
    return "\n".join(out)


def build_pdf(pages, path):
    """pages: list of pages, each a list of text lines. Writes a valid PDF."""
    objects = []  # list of raw object bodies (bytes), index 0 -> obj 1

    # Catalog (obj 1) and Pages (obj 2) reference page objects we allocate below.
    n_pages = len(pages)
    # Object numbering:
    #  1 = Catalog, 2 = Pages, 3 = Font,
    #  then for each page: a Page obj and a Contents obj.
    font_obj = 3
    page_obj_ids, content_obj_ids = [], []
    nid = 4
    for _ in range(n_pages):
        page_obj_ids.append(nid); nid += 1
        content_obj_ids.append(nid); nid += 1

    kids = " ".join(f"{pid} 0 R" for pid in page_obj_ids)
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode())
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for i in range(n_pages):
        page_body = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Contents {content_obj_ids[i]} 0 R "
            f"/Resources << /Font << /F1 {font_obj} 0 R >> >> >>"
        ).encode()
        objects.append(page_body)
        stream = _content_stream(pages[i]).encode()
        content_body = b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream)
        objects.append(content_body)

    # Serialize with byte-offset tracking for the xref table.
    buf = b"%PDF-1.4\n"
    offsets = []
    for idx, body in enumerate(objects, start=1):
        offsets.append(len(buf))
        buf += b"%d 0 obj\n" % idx + body + b"\nendobj\n"

    xref_pos = len(buf)
    n_objs = len(objects)
    buf += b"xref\n0 %d\n" % (n_objs + 1)
    buf += b"0000000000 65535 f \n"
    for off in offsets:
        buf += b"%010d 00000 n \n" % off
    buf += (b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"
            % (n_objs + 1, xref_pos))

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(buf)
    return path


NOTES_PAGES = [
    [
        "Data Structures - Trees: Revision Notes",
        "",
        "A binary search tree (BST) is a binary tree in which every node has at",
        "most two children. For each node, all keys in the left subtree are less",
        "than the node's key, and all keys in the right subtree are greater. This",
        "ordering property makes search, insertion, and deletion efficient.",
        "",
        "Search in a BST: start at the root and compare the target key with the",
        "current node. If equal, the search succeeds. If the target is smaller, go",
        "left; if larger, go right. The average time complexity is O(log n) when",
        "the tree is balanced, but degrades to O(n) for a skewed tree.",
        "",
        "Insertion follows the same path as search until reaching an empty spot,",
        "where the new node is attached as a leaf.",
    ],
    [
        "Balanced Trees and Traversals",
        "",
        "An AVL tree is a self-balancing binary search tree where the heights of",
        "the two child subtrees of any node differ by at most one. After insertion",
        "or deletion, rotations restore the balance, guaranteeing O(log n) height.",
        "",
        "Tree traversals visit nodes in a defined order. In-order traversal of a",
        "BST visits nodes in ascending key order: left subtree, node, right",
        "subtree. Pre-order visits the node before its subtrees; post-order visits",
        "the node after its subtrees. Level-order traversal uses a queue to visit",
        "nodes breadth-first, one level at a time.",
    ],
]

EXAM_PAGES = [
    [
        "Data Structures - Previous Year Question Paper",
        "",
        "Q1. Define a binary search tree and state its ordering property. (5 marks)",
        "",
        "Q2. Explain the time complexity of search in a balanced versus a skewed",
        "binary search tree. (5 marks)",
        "",
        "Q3. What is an AVL tree? Describe how rotations keep it balanced after an",
        "insertion. (10 marks)",
        "",
        "Q4. Write the in-order, pre-order, and post-order traversal of a given",
        "binary tree and explain how level-order traversal differs. (10 marks)",
    ],
]


if __name__ == "__main__":
    notes = build_pdf(NOTES_PAGES, os.path.join(FIXTURES, "DS_notes.pdf"))
    exam = build_pdf(EXAM_PAGES, os.path.join(FIXTURES, "DS_exam.pdf"))
    print("Wrote:", notes)
    print("Wrote:", exam)
