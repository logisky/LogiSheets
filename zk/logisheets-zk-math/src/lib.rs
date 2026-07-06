#![no_std]
#![deny(unsafe_code)]

//! Pure, no-std financial math functions used inside the ZK guest and host.
//!
//! This crate is a minimal extraction of the `crates/controller/src/calc_engine/calculator/math/`
//! module. Functions only rely on `core::f64` operations and small slices, making them safe to run
//! inside a RiscZero zkVM guest without the standard library.

pub mod fv;
pub mod irr;
pub mod newton_iter;
pub mod npv;
pub mod pmt;
pub mod pv;
pub mod sln;

/// Aggregate re-exports commonly used by guest programs.
pub mod finance {
    pub use crate::fv::calc_fv;
    pub use crate::irr::calc_irr;
    pub use crate::npv::calc_npv;
    pub use crate::pmt::{calc_ipmt, calc_pmt, calc_ppmt};
    pub use crate::pv::calc_pv;
    pub use crate::sln::{calc_sln, calc_syd};
}
