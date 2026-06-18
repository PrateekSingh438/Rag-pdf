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
    "stacks.pdf": {
        "doc_type": "notes",
        "text": (
            "Stacks. A stack is a last-in, first-out (LIFO) collection that supports two main "
            "operations in O(1) time: push, which adds an element to the top, and pop, which "
            "removes and returns the most recently added element. Only the top is accessible — "
            "there is no way to reach an element in the middle without removing the ones above "
            "it. A stack is typically built on a dynamic array or a singly linked list, and it "
            "keeps no ordering beyond insertion recency. Stacks model any process that must "
            "unwind in reverse order: the function call stack that tracks return addresses and "
            "local variables, the undo history in an editor, balanced-parenthesis and "
            "expression evaluation, and the explicit frontier of an iterative depth-first "
            "search. Because access is restricted to one end, a stack is the wrong choice when "
            "you need to inspect or remove the oldest item, scan arbitrary positions, or keep "
            "elements sorted. Its strength is exactly that restriction: the LIFO discipline "
            "makes reasoning about nesting and backtracking simple and the operations trivially "
            "constant time."
        ),
    },
    "queues.pdf": {
        "doc_type": "notes",
        "text": (
            "Queues. A queue is a first-in, first-out (FIFO) collection: elements are enqueued "
            "at the rear and dequeued from the front, both in O(1) time, so the item that has "
            "waited longest is always served next. Unlike a stack, which touches only one end, "
            "a queue uses both ends — insert at the back, remove at the front — and is commonly "
            "implemented as a circular buffer over an array or as a linked list with head and "
            "tail pointers. Queues model fairness and ordering over time: task and request "
            "scheduling, print spooling, buffering between a fast producer and a slow consumer, "
            "and the frontier of a breadth-first search, which must expand nodes in the order "
            "they were discovered. A queue is the wrong structure when you need last-in-first-"
            "out unwinding, random access by position, or priority ordering — for always "
            "serving the most important rather than the oldest item, a priority queue backed by "
            "a heap is used instead. The defining property is temporal fairness: whoever "
            "arrived first leaves first."
        ),
    },
    "red_black_trees.pdf": {
        "doc_type": "notes",
        "text": (
            "Red-Black Trees. A red-black tree is a self-balancing binary search tree that keeps "
            "the same left-smaller, right-larger ordering invariant but enforces balance through "
            "node colors rather than strict subtree heights. Each node is red or black, the root "
            "and leaves are black, a red node may not have a red child, and every root-to-leaf "
            "path contains the same number of black nodes; these rules bound the longest path at "
            "no more than twice the shortest, keeping height O(log n). After an insertion or "
            "deletion the tree restores the invariants with recoloring and a small number of "
            "rotations. Compared with an AVL tree, a red-black tree balances more loosely, so it "
            "is taller and its lookups are slightly slower, but it performs fewer rotations on "
            "updates, which makes inserts and deletes faster — the reason it backs many standard-"
            "library ordered maps and sets, such as C++ std::map and Java TreeMap. Choose a red-"
            "black tree when updates are frequent and you want guaranteed O(log n) operations "
            "with less rebalancing overhead than AVL; choose AVL when lookups dominate and you "
            "want the shallowest possible tree."
        ),
    },
    "heapsort.pdf": {
        "doc_type": "notes",
        "text": (
            "Heapsort. Heapsort is a comparison sort that first builds a binary heap from the "
            "input array in O(n) time and then repeatedly extracts the maximum, swapping it to "
            "the end and shrinking the heap, until the array is sorted. Because the heap lives "
            "inside the same array, heapsort sorts in place, needing only O(1) extra space, and "
            "it guarantees O(n log n) time in the best, average, and worst cases — combining "
            "quicksort's in-place memory profile with merge sort's worst-case guarantee. Its "
            "drawbacks are that it is not stable, so equal elements can be reordered, and its "
            "scattered, non-sequential access pattern gives poorer cache locality than "
            "quicksort, so in practice it is often slower despite the same asymptotic bound. "
            "Heapsort is the right choice when you need a strict O(n log n) worst case and "
            "cannot afford the auxiliary array that merge sort requires; it is also closely tied "
            "to the priority queue, since both are powered by the heap. It is a poor choice when "
            "stability matters or when average-case speed and cache behavior are the priority."
        ),
    },
    "insertion_sort.pdf": {
        "doc_type": "notes",
        "text": (
            "Insertion Sort. Insertion sort builds the sorted result one element at a time: it "
            "scans from left to right and, for each new element, slides it backward into its "
            "correct place among the already-sorted prefix. It runs in O(n squared) time in the "
            "average and worst cases, which makes it unsuitable for large random inputs, but it "
            "has redeeming qualities the fast divide-and-conquer sorts lack. It is in place, "
            "needing only O(1) extra space; it is stable, preserving the order of equal keys; "
            "and it is adaptive, running in nearly O(n) time when the input is already almost "
            "sorted, because few shifts are needed. Its simplicity and low constant factors make "
            "it faster than quicksort or merge sort on very small arrays, which is why optimized "
            "library sorts switch to insertion sort for small subproblems. Choose insertion sort "
            "for small or nearly-sorted data, or as the base case inside a larger sort; avoid it "
            "as a general-purpose sort for large, unordered inputs, where an O(n log n) "
            "algorithm wins decisively."
        ),
    },
    "graph_bfs.pdf": {
        "doc_type": "notes",
        "text": (
            "Breadth-First Search. Breadth-first search (BFS) explores a graph level by level: "
            "starting from a source vertex it visits all immediate neighbors, then their "
            "neighbors, and so on, using a FIFO queue to hold the frontier of discovered-but-"
            "unexpanded vertices and a visited set to avoid revisiting. Because it expands "
            "vertices in order of increasing distance, BFS finds the shortest path in an "
            "unweighted graph — the first time it reaches a vertex is along a path with the "
            "fewest edges. It runs in O(V + E) time on an adjacency list. BFS is the right tool "
            "for shortest-hop problems, finding connected components, testing bipartiteness, and "
            "any search where the goal is likely close to the source. It contrasts with depth-"
            "first search, which plunges deep along one path before backtracking and uses a "
            "stack; BFS instead stays shallow and wide. Its cost is memory: the queue can hold a "
            "whole level, which in a wide graph is a large fraction of the vertices, so BFS can "
            "use much more memory than a depth-first traversal of the same graph."
        ),
    },
    "graph_dfs.pdf": {
        "doc_type": "notes",
        "text": (
            "Depth-First Search. Depth-first search (DFS) explores a graph by going as deep as "
            "possible along each branch before backtracking: from a vertex it follows one edge "
            "to an unvisited neighbor, repeats, and only when it gets stuck does it back up to "
            "the most recent vertex with unexplored edges. It is naturally expressed with "
            "recursion or an explicit LIFO stack, plus a visited set, and runs in O(V + E) "
            "time. Unlike breadth-first search, DFS does not find shortest paths in general, but "
            "its deep, backtracking order makes it the engine for a different family of "
            "problems: detecting cycles, producing a topological ordering of a directed acyclic "
            "graph, finding strongly connected components, and exhaustively enumerating paths. "
            "Its memory use is proportional to the longest path (the recursion or stack depth), "
            "which is typically far smaller than the wide frontier a breadth-first search must "
            "store, though very deep graphs risk stack overflow. Choose DFS for connectivity, "
            "ordering, and backtracking tasks; choose breadth-first search when you need the "
            "fewest-edge path or are searching near the source."
        ),
    },
    "tries.pdf": {
        "doc_type": "notes",
        "text": (
            "Tries. A trie, or prefix tree, stores a set of strings by their characters: each "
            "edge is labeled with a character and each path from the root spells a prefix, so "
            "all keys sharing a prefix share the same initial path and a node marks where a "
            "complete word ends. Lookup, insertion, and deletion of a key take time proportional "
            "to the length of the key, independent of how many keys are stored, and the trie "
            "supports operations a hash table cannot do efficiently: listing all words with a "
            "given prefix, autocomplete, and ordered traversal of the keys. Unlike a binary "
            "search tree, a trie branches on characters rather than whole-key comparisons, and "
            "unlike a hash table it never computes a hash or suffers collisions. The cost is "
            "memory: each node may hold many child pointers, one per possible character, so a "
            "sparse trie can waste a great deal of space, which compressed variants like radix "
            "trees mitigate. Choose a trie for prefix queries, dictionary and autocomplete "
            "features, and string-keyed lookups where shared prefixes are common; avoid it when "
            "keys are long and unrelated and memory is tight."
        ),
    },
    "bloom_filters.pdf": {
        "doc_type": "notes",
        "text": (
            "Bloom Filters. A Bloom filter is a space-efficient probabilistic data structure "
            "that tests whether an element is a member of a set. It is a bit array combined with "
            "several independent hash functions; to insert an element you hash it with each "
            "function and set the corresponding bits, and to query you check whether all those "
            "bits are set. Its defining trade-off is one-sided error: a Bloom filter can produce "
            "false positives — reporting that an absent element is present because its bits "
            "happened to be set by others — but it never produces false negatives, so a 'not "
            "present' answer is always correct. It stores no actual keys, only bits, so it uses "
            "far less memory than a hash table, at the price of not being able to retrieve "
            "elements or, in the standard form, delete them. The false-positive rate rises as "
            "more elements are added and is tuned by choosing the bit-array size and number of "
            "hash functions. Bloom filters are used as a cheap front-line check before an "
            "expensive lookup — for example to avoid disk reads for keys that are definitely "
            "absent. Choose one when approximate membership in little memory is acceptable; "
            "avoid it when you need exact answers or must enumerate or remove elements."
        ),
    },
}
