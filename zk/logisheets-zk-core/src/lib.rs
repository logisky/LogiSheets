#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub mod smt;
#[cfg(feature = "std")]
pub mod smt_builder;

use alloc::string::String;
use alloc::vec::Vec;
use serde::{Deserialize, Serialize};

/// A single formula committed to the Sparse Merkle Tree.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Formula {
    pub id: [u8; 32],
    pub name: String,
    pub expression: String,
    pub version: u64,
}

impl Formula {
    pub fn commitment(&self) -> [u8; 32] {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&self.id);
        bytes.extend_from_slice(self.expression.as_bytes());
        sha2_hash(&bytes)
    }
}

/// A formula bundled with its Merkle proof of inclusion in the SMT.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct FormulaWithProof {
    pub formula: Formula,
    pub proof: smt::MerkleProof,
}

/// Definition of an expected public output.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct OutputDef {
    pub name: String,
}

/// Public inputs to the guest program.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct PublicInputs {
    pub formula_root: [u8; 32],
    pub values: Vec<(String, f64)>,
    pub expected_outputs: Vec<OutputDef>,
}

/// Private inputs to the guest program.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct PrivateInputs {
    pub formulas_with_proofs: Vec<FormulaWithProof>,
    pub values: Vec<(String, f64)>,
}

/// Combined input for the prover.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ProverInput {
    pub public: PublicInputs,
    pub private: PrivateInputs,
}

/// Final on-chain report output.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct QuarterlyReport {
    pub fund_id: u64,
    pub quarter_id: u64,
    pub formula_root: [u8; 32],
    pub outputs: Vec<(String, f64)>,
}

/// SHA-256 helper. Works in both std and no_std contexts.
pub fn sha2_hash(bytes: &[u8]) -> [u8; 32] {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher.finalize().into()
}
