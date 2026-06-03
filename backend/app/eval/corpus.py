"""Bundled evaluation corpus: a small multi-document knowledge base used only by
run_eval.py to build an ephemeral index and measure retrieval/answer quality.

The documents are deliberately split into FINE-GRAINED, CONFUSABLE topics that
share heavy vocabulary in confusable pairs (dynamic arrays vs linked lists,
quicksort vs merge sort, hash chaining vs open addressing, BST vs AVL vs heaps).
The dataset then asks PARAPHRASED questions that hinge on each topic's
distinguishing property. A bi-encoder, which matches on surface semantics, is
easily pulled toward the lexically-similar wrong document; the cross-encoder
reranker, which reads query and passage together, resolves it — so the ablation
shows the reranker improving recall@k.

Each doc is one page of ~300+ words, so the chunk_size ablation (256 vs 512)
produces genuinely different chunkings. We feed the text straight into the
chunker, exercising the real chunk -> embed -> retrieve -> rerank pipeline.
"""

CORPUS: dict[str, dict] = {
    "dynamic_arrays.pdf": {
        "doc_type": "notes",
        "text": (
            "Dynamic Arrays. A dynamic array stores its elements in one contiguous block of "
            "memory and exposes them by integer index. Because the address of element i is "
            "computed directly from the base address, reading or writing any element by its "
            "index takes constant O(1) time and the structure has excellent cache locality, "
            "making it ideal for random access and tight numerical loops. When the array runs "
            "out of capacity it allocates a larger block, usually double the size, and copies "
            "the existing elements over; this doubling strategy makes appending to the end "
            "amortized O(1) even though an individual append that triggers a resize is O(n). "
            "The weakness of a dynamic array is the middle: inserting or deleting an element "
            "anywhere except the end forces every later element to shift by one position, "
            "which costs O(n) time. Memory is compact because only the values are stored, with "
            "no per-element overhead. A dynamic array is the right choice when you need fast "
            "indexed access, predictable iteration, and mostly append-only growth, and a poor "
            "choice when you must frequently splice items into or out of the middle of the "
            "sequence. Languages expose it as a vector, ArrayList, or list."
        ),
    },
    "linked_lists.pdf": {
        "doc_type": "notes",
        "text": (
            "Linked Lists. A linked list stores each element in its own node that holds the "
            "value together with a pointer to the next node, so the elements are not laid out "
            "contiguously in memory. The defining strength is splicing: once you hold a "
            "reference to a node, inserting a new node after it or removing it takes constant "
            "O(1) time because only a couple of pointers are rewired and nothing is shifted. "
            "The defining weakness is access by position: there is no index arithmetic, so "
            "reaching the k-th element means walking from the head following pointers, which "
            "costs O(n) time and suffers poor cache locality because nodes are scattered. A "
            "singly linked list has one forward pointer per node; a doubly linked list adds a "
            "backward pointer so it can be traversed in both directions and a known node can "
            "be deleted in O(1) without first scanning for its predecessor. Each node carries "
            "pointer overhead, so a linked list uses more memory per element than an array. "
            "Linked lists shine when the workload is dominated by insertions and deletions at "
            "the ends or at already-known positions, and they are a poor fit when you need to "
            "jump directly to an arbitrary index. The head reference is the only entry point."
        ),
    },
    "binary_search_trees.pdf": {
        "doc_type": "notes",
        "text": (
            "Binary Search Trees. A binary search tree (BST) is a binary tree that maintains "
            "an ordering invariant: for every node, all keys stored in its left subtree are "
            "smaller than the node's key and all keys in its right subtree are larger. This "
            "invariant lets search, insertion, and deletion each follow a single path from the "
            "root toward a leaf, comparing the target with the current key and going left or "
            "right accordingly. When the tree is reasonably balanced these operations cost "
            "O(log n) time, but a plain BST has no mechanism to keep itself balanced, so "
            "inserting already-sorted keys produces a skewed tree that behaves like a linked "
            "list and degrades to O(n). An in-order traversal of a BST visits the keys in "
            "ascending sorted order, which is a property heaps do not have. BSTs support "
            "ordered operations such as range queries, predecessor, and successor, which hash "
            "tables cannot do efficiently. The plain BST is best understood as the unbalanced "
            "baseline: it gives ordered, logarithmic operations only when the insertion order "
            "happens to keep it shallow, and it makes no self-balancing guarantee of its own."
        ),
    },
    "avl_trees.pdf": {
        "doc_type": "notes",
        "text": (
            "AVL Trees. An AVL tree is a self-balancing binary search tree, so it keeps the "
            "same left-smaller, right-larger ordering invariant as an ordinary BST but adds a "
            "height-balance condition: for every node the heights of its left and right "
            "subtrees may differ by at most one. Every node stores a balance factor, and after "
            "an insertion or deletion the tree walks back up toward the root and, wherever the "
            "balance condition is violated, performs rotations — single or double — that "
            "locally restructure a few nodes to restore balance. Because the height is kept "
            "logarithmic by these rotations, search, insertion, and deletion are guaranteed "
            "O(log n) even in the worst case, which is the key improvement over a plain BST "
            "that can degenerate into a linked list. The cost is the bookkeeping: AVL trees do "
            "extra work and rotations on every update to stay strictly balanced, which makes "
            "them slightly slower on write-heavy workloads than more loosely balanced trees. "
            "AVL trees are the right answer when you need worst-case logarithmic ordered "
            "operations and the data may arrive in sorted or adversarial order."
        ),
    },
    "binary_heaps.pdf": {
        "doc_type": "notes",
        "text": (
            "Binary Heaps. A binary heap is a complete binary tree that satisfies the heap "
            "property: in a min-heap every parent is less than or equal to its children, and "
            "in a max-heap every parent is greater than or equal to its children. Crucially "
            "the heap only orders each parent against its own children — it does NOT keep the "
            "whole set sorted and there is no left-smaller-right-larger rule, so an in-order "
            "walk of a heap is meaningless. Because the tree is complete it is stored compactly "
            "in an array where the children of index i sit at 2i+1 and 2i+2. The smallest (or "
            "largest) element is always at the root, so reading the top is O(1), while "
            "inserting an element or extracting the top costs O(log n) as the element sifts up "
            "or down to restore the heap property. This makes a binary heap the standard "
            "implementation of a priority queue, which always serves the highest-priority item "
            "next, and the engine of heapsort. A heap is the right structure when you "
            "repeatedly need the single minimum or maximum, and the wrong one when you need "
            "fully sorted order or range queries."
        ),
    },
    "quicksort.pdf": {
        "doc_type": "notes",
        "text": (
            "Quicksort. Quicksort is a divide-and-conquer comparison sort that works by "
            "choosing a pivot element and partitioning the array so that everything smaller "
            "than the pivot comes before it and everything larger comes after, then "
            "recursively sorting the two partitions. Its great practical advantage is that it "
            "sorts in place, needing only O(log n) stack space and no large auxiliary array, "
            "and on typical inputs it is very fast with O(n log n) average time and small "
            "constant factors. Its weakness is sensitivity to the pivot: a consistently poor "
            "pivot, such as always picking the first element of already-sorted data, makes the "
            "partitions lopsided and degrades the running time to O(n squared). Randomizing "
            "the pivot or using the median-of-three rule makes that worst case very unlikely. "
            "Quicksort is also not stable, meaning equal elements may have their relative order "
            "changed by partitioning. Choose quicksort when memory is tight and average-case "
            "speed matters more than worst-case guarantees or stability; avoid it when you "
            "need a strict O(n log n) bound or must preserve the order of equal keys."
        ),
    },
    "merge_sort.pdf": {
        "doc_type": "notes",
        "text": (
            "Merge Sort. Merge sort is a divide-and-conquer comparison sort that recursively "
            "splits the array into two halves, sorts each half, and then merges the two sorted "
            "halves back together by repeatedly taking the smaller front element. Its defining "
            "strengths are a guaranteed O(n log n) running time in the best, average, and "
            "worst cases, and stability: because the merge step takes from the left half on "
            "ties, equal elements keep their original relative order. The defining cost is "
            "memory: the standard merge needs an auxiliary array of size O(n), so unlike "
            "quicksort it does not sort in place. That extra-space requirement and the "
            "predictable worst case are exactly what distinguish it from quicksort. Merge sort "
            "also adapts well to data that does not fit in memory and to linked lists, where it "
            "can merge without random access. Choose merge sort when you need a dependable "
            "worst-case bound or must keep equal elements in order and can afford linear extra "
            "space; prefer an in-place sort when memory is the binding constraint."
        ),
    },
    "hashing_chaining.pdf": {
        "doc_type": "notes",
        "text": (
            "Hash Tables with Separate Chaining. A hash table maps each key through a hash "
            "function to a bucket index in an array and stores key-value pairs there for "
            "average O(1) insertion, deletion, and lookup. Separate chaining resolves "
            "collisions — two keys hashing to the same bucket — by having each bucket hold a "
            "secondary container, typically a linked list, into which all colliding entries "
            "are appended. A lookup hashes to the bucket and then scans that short list. The "
            "load factor, the number of stored entries divided by the number of buckets, can "
            "exceed one with chaining because each bucket can hold many entries, though "
            "performance degrades as the chains grow, so the table is resized and rehashed when "
            "the load factor gets high. Chaining is simple, degrades gracefully under a high "
            "load factor, and tolerates a mediocre hash function, at the cost of extra memory "
            "for the list nodes and pointers and worse cache locality than storing entries "
            "directly in the table. It is the collision strategy to reach for when deletions "
            "are frequent or the load factor may climb."
        ),
    },
    "hashing_open_addressing.pdf": {
        "doc_type": "notes",
        "text": (
            "Hash Tables with Open Addressing. A hash table maps each key through a hash "
            "function to a slot in an array for average O(1) operations. Open addressing "
            "resolves collisions without any external lists: when the slot a key hashes to is "
            "already occupied, the algorithm probes a deterministic sequence of other slots in "
            "the same array until it finds an empty one. Linear probing checks the next slot, "
            "then the one after that; quadratic probing jumps by growing offsets to reduce "
            "clustering; and double hashing uses a second hash function to compute the step "
            "size. Because every entry lives directly inside the array, open addressing has "
            "excellent cache locality and no pointer overhead, but its load factor must stay "
            "well below one — empty slots are required for probing to terminate — so the table "
            "is resized as it fills, and deletions need tombstone markers so probe sequences "
            "are not broken. Open addressing is the collision strategy to choose when memory "
            "compactness and cache performance matter and the load factor can be kept low."
        ),
    },
}
