//! The browser transport for the LogiSheets engine, built with `wasm-pack`
//! into `packages/web/wasm` (`yarn wasm`) and wrapped by the `logisheets-web`
//! SDK.
//!
//! It owns no logic. A single-threaded [`Manager`](logisheets_rs::rpc::Manager)
//! singleton holds every open workbook; `rpc::handle` decodes a
//! [`Message`](logisheets_rs::rpc::Message), calls the matching function in
//! `logisheets_rs::rpc::{controller, ws}` and serializes the answer. The
//! desktop (Tauri) host drives the same functions natively.
//!
//! Exports: `handle(msg, bookId)` for every RPC method,
//! `input_async_result` for results of host-computed async functions, and
//! `format_number` / `format_text` (number-format rendering via `ssf-rs`).
//! None may panic: a panic poisons the wasm instance and every later call
//! traps, so every failure is returned as an `ErrorMessage`.
#![allow(dead_code)]
mod rpc;
mod state;
