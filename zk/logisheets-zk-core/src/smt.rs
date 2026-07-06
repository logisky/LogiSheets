//! Sparse Merkle Tree primitives for formula commitment.
//!
//! Tree height is 256 (one leaf per possible 32-byte formula id).
//! Empty leaves hash to `hash([0u8; 32])`.
//! Sibling order in proofs is from leaf toward root (level 0 first).

extern crate alloc;

use alloc::vec::Vec;
use serde::{Deserialize, Serialize};

use crate::sha2_hash;

/// Hash of an empty leaf. Used for all unoccupied positions.
pub fn empty_leaf_hash() -> [u8; 32] {
    sha2_hash(&[0u8; 32])
}

/// Hash two child hashes into a parent node hash.
pub fn node_hash(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut bytes = Vec::with_capacity(64);
    bytes.extend_from_slice(left);
    bytes.extend_from_slice(right);
    sha2_hash(&bytes)
}

/// Hash a committed formula leaf.
pub fn leaf_hash(id: &[u8; 32], commitment: &[u8; 32]) -> [u8; 32] {
    let mut bytes = Vec::with_capacity(64);
    bytes.extend_from_slice(id);
    bytes.extend_from_slice(commitment);
    sha2_hash(&bytes)
}

/// Sparse Merkle Tree inclusion proof.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct MerkleProof {
    /// Sibling hashes from leaf to root, ordered level 0 first.
    pub siblings: Vec<[u8; 32]>,
}

/// Verifies that `(id, commitment)` maps to `root` using the provided proof.
pub fn verify_proof(root: &[u8; 32], id: &[u8; 32], commitment: &[u8; 32], proof: &MerkleProof) {
    assert_eq!(
        proof.siblings.len(),
        256,
        "Merkle proof must contain exactly 256 siblings"
    );

    let mut current = leaf_hash(id, commitment);
    for (level, sibling) in proof.siblings.iter().enumerate() {
        let bit = bit_at(id, level);
        current = if bit {
            // current is right child
            node_hash(sibling, &current)
        } else {
            // current is left child
            node_hash(&current, sibling)
        };
    }

    assert_eq!(current, *root, "Merkle proof verification failed");
}

/// Returns the `index`-th bit of `id` (least significant bit first).
fn bit_at(id: &[u8; 32], index: usize) -> bool {
    assert!(index < 256);
    let byte_index = index / 8;
    let bit_index = index % 8;
    (id[byte_index] >> bit_index) & 1 == 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bit_at_works() {
        let mut id = [0u8; 32];
        id[0] = 0b0000_0001;
        assert!(bit_at(&id, 0));
        assert!(!bit_at(&id, 1));
        id[0] = 0b0000_0010;
        assert!(!bit_at(&id, 0));
        assert!(bit_at(&id, 1));
    }

    #[test]
    fn empty_tree_root_is_deterministic() {
        let mut current = empty_leaf_hash();
        for _ in 0..256 {
            current = node_hash(&current, &current);
        }
        // The root of an all-empty SMT is deterministic.
        let expected = current;
        let mut current2 = empty_leaf_hash();
        for _ in 0..256 {
            current2 = node_hash(&current2, &current2);
        }
        assert_eq!(current2, expected);
    }
}
