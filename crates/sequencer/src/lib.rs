//! The collaborative-editing server for LogiSheets: one room per file, where
//! a sequencer orders every user's edits against a shared controller and
//! broadcasts the result.
//!
//! Status: an unfinished prototype. Only the wire types (`msg`, re-exported
//! here) are live: `buildtools` emits [`UserMessage`] and
//! [`SequencerMessage`] (and what they reference) into
//! `packages/web/src/bindings`, so changing them changes the generated TS. The room loop (`room`) handles `Join` only, the websocket
//! server (`server`) is all `todo!()`, and the `logisheets_sequencer` binary
//! is an empty `main`.

#![allow(dead_code)]
mod msg;
mod room;
mod server;

pub use msg::*;
