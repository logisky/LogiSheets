//! Sparse Merkle Tree builder (host-side, std required).
//!
//! This module provides an in-memory SMT that can be incrementally updated and
//! can generate inclusion proofs for committed formulas.

use alloc::vec::Vec;
use hashbrown::HashMap;

use crate::smt::{empty_leaf_hash, leaf_hash, node_hash};

/// A 256-depth Sparse Merkle Tree for formula commitments.
#[derive(Clone, Debug, Default)]
pub struct SparseMerkleTree {
    /// Map from leaf key (formula id) to leaf commitment hash.
    leaves: HashMap<[u8; 32], [u8; 32]>,
    /// Memoized subtree roots keyed by (depth, prefix_bits_as_bytes truncated to depth bits).
    cache: HashMap<(usize, Vec<u8>), [u8; 32]>,
}

impl SparseMerkleTree {
    pub fn new() -> Self {
        Self {
            leaves: HashMap::new(),
            cache: HashMap::new(),
        }
    }

    /// Insert or update a leaf.
    pub fn insert(&mut self, id: [u8; 32], commitment: [u8; 32]) {
        self.leaves.insert(id, commitment);
        self.invalidate_cache();
    }

    /// Remove a leaf (effectively sets it to the empty leaf hash).
    pub fn remove(&mut self, id: &[u8; 32]) {
        self.leaves.remove(id);
        self.invalidate_cache();
    }

    fn invalidate_cache(&mut self) {
        self.cache.clear();
    }

    /// Compute the current SMT root.
    pub fn root(&mut self) -> [u8; 32] {
        self.subtree_root(0, &[])
    }

    /// Generate a 256-level inclusion proof for `id`.
    pub fn proof(&mut self, id: &[u8; 32]) -> crate::smt::MerkleProof {
        let mut siblings = Vec::with_capacity(256);
        for level in 0..256 {
            let sibling_prefix = sibling_prefix(id, level);
            let sibling_root = self.subtree_root(level + 1, &sibling_prefix);
            siblings.push(sibling_root);
        }
        crate::smt::MerkleProof { siblings }
    }

    /// Recursive subtree root computation with memoization.
    fn subtree_root(&mut self, depth: usize, prefix: &[u8]) -> [u8; 32] {
        if let Some(root) = self.cache.get(&(depth, prefix.to_vec())) {
            return *root;
        }

        let root = if depth == 256 {
            // Decode the 256-bit key from prefix bytes.
            let mut id = [0u8; 32];
            id.copy_from_slice(prefix);
            if let Some(commitment) = self.leaves.get(&id) {
                leaf_hash(&id, commitment)
            } else {
                empty_leaf_hash()
            }
        } else {
            let left = self.subtree_root(depth + 1, &extend_prefix(prefix, false));
            let right = self.subtree_root(depth + 1, &extend_prefix(prefix, true));
            node_hash(&left, &right)
        };

        self.cache.insert((depth, prefix.to_vec()), root);
        root
    }
}

/// Compute the sibling prefix at `level` for `id`.
/// `level` ranges from 0 (leaf) to 255 (root child).
fn sibling_prefix(id: &[u8; 32], level: usize) -> Vec<u8> {
    assert!(level < 256);
    let mut bits = Vec::with_capacity(level + 1);
    for i in 0..=level {
        bits.push(bit_at(id, i));
    }
    // Flip the last bit to get the sibling branch.
    let last = bits.len() - 1;
    bits[last] = !bits[last];
    bits_to_bytes(&bits)
}

fn extend_prefix(prefix: &[u8], bit: bool) -> Vec<u8> {
    let mut bits = bytes_to_bits(prefix);
    bits.push(bit);
    bits_to_bytes(&bits)
}

fn bit_at(id: &[u8; 32], index: usize) -> bool {
    let byte_index = index / 8;
    let bit_index = index % 8;
    (id[byte_index] >> bit_index) & 1 == 1
}

fn bits_to_bytes(bits: &[bool]) -> Vec<u8> {
    let mut bytes = vec![0u8; (bits.len() + 7) / 8];
    for (i, bit) in bits.iter().enumerate() {
        if *bit {
            bytes[i / 8] |= 1 << (i % 8);
        }
    }
    bytes
}

fn bytes_to_bits(bytes: &[u8]) -> Vec<bool> {
    let mut bits = Vec::with_capacity(bytes.len() * 8);
    for byte in bytes {
        for i in 0..8 {
            bits.push((byte >> i) & 1 == 1);
        }
    }
    bits
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sha2_hash;

    fn id_from_u64(n: u64) -> [u8; 32] {
        let mut id = [0u8; 32];
        id[..8].copy_from_slice(&n.to_le_bytes());
        id
    }

    #[test]
    fn empty_tree_root_stable() {
        let mut tree1 = SparseMerkleTree::new();
        let mut tree2 = SparseMerkleTree::new();
        assert_eq!(tree1.root(), tree2.root());
    }

    #[test]
    fn insert_changes_root() {
        let mut tree = SparseMerkleTree::new();
        let empty_root = tree.root();
        let id = id_from_u64(42);
        tree.insert(id, sha2_hash(b"commitment"));
        let occupied_root = tree.root();
        assert_ne!(empty_root, occupied_root);
    }

    #[test]
    fn proof_verifies() {
        let mut tree = SparseMerkleTree::new();
        let id = id_from_u64(42);
        let commitment = sha2_hash(b"commitment");
        tree.insert(id, commitment);
        let root = tree.root();
        let proof = tree.proof(&id);
        crate::smt::verify_proof(&root, &id, &commitment, &proof);
    }

    #[test]
    fn delete_returns_to_empty_root() {
        let mut tree = SparseMerkleTree::new();
        let id = id_from_u64(42);
        let commitment = sha2_hash(b"commitment");
        tree.insert(id, commitment);
        tree.remove(&id);
        let root_after_delete = tree.root();
        let mut empty_tree = SparseMerkleTree::new();
        assert_eq!(root_after_delete, empty_tree.root());
    }
}
