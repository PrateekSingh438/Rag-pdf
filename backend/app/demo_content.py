"""Bundled sample content for the one-click demo knowledge base (onboarding).
Seeded directly as text (no PDF needed), so it works in any deployment."""

DEMO_NOTES = (
    "Data Structures - Trees: Revision Notes. A binary search tree (BST) is a binary "
    "tree in which every node has at most two children. For each node, all keys in the "
    "left subtree are less than the node's key, and all keys in the right subtree are "
    "greater. This ordering property makes search, insertion, and deletion efficient. "
    "Search starts at the root and compares the target with the current node, going "
    "left if smaller and right if larger; the average time complexity is O(log n) for a "
    "balanced tree but degrades to O(n) for a skewed tree. Insertion follows the same "
    "path until it reaches an empty spot, where the new node is attached as a leaf.\n\n"
    "An AVL tree is a self-balancing binary search tree where the heights of the two "
    "child subtrees of any node differ by at most one. After an insertion or deletion, "
    "rotations restore the balance, guaranteeing O(log n) height. Tree traversals visit "
    "nodes in a defined order: in-order traversal of a BST visits keys in ascending "
    "order, pre-order visits a node before its subtrees, post-order visits a node after "
    "its subtrees, and level-order uses a queue to visit nodes breadth-first one level "
    "at a time."
)

DEMO_EXAM = (
    "Data Structures - Previous Year Question Paper. "
    "Q1. Define a binary search tree and state its ordering property. (5 marks) "
    "Q2. Explain the time complexity of search in a balanced versus a skewed binary "
    "search tree. (5 marks) "
    "Q3. What is an AVL tree? Describe how rotations keep it balanced after an "
    "insertion. (10 marks) "
    "Q4. Write the in-order, pre-order, and post-order traversal of a binary tree and "
    "explain how level-order traversal differs. (10 marks)"
)
