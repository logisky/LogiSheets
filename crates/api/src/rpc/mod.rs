//! Transport-agnostic RPC layer for driving LogiSheets over a message boundary.
//!
//! This module holds the multi-workbook [`Manager`], the wire protocol
//! ([`Message`] + its params/DTOs), and the serialization-free logic functions
//! ([`controller`], [`ws`]) that a transport dispatches to. It is gated behind
//! the `rpc` cargo feature so the default `logisheets-rs` public API stays a
//! thin `Workbook` facade.
//!
//! A transport (the browser WASM binding, or a native Tauri command layer)
//! owns the `Manager`, deserializes a `Message`, calls the matching logic
//! function, and serializes the typed result at its own edge — the logic
//! functions themselves never touch a serialization format.

mod manager;
mod message;

pub mod controller;
pub mod ws;

pub use manager::Manager;
pub use message::*;
