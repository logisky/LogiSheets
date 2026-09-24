//! `yarn gen-bindings` runs this binary (from the repo root) to regenerate the
//! TypeScript bindings in `packages/web/src/bindings` from Rust types that
//! derive `gents`' `TS`.
//!
//! Registering a type pulls in everything it references, so the roots here
//! are enough: [`WorkbookMethods`](logisheets_rs::rpc::WorkbookMethods)
//! brings every RPC params and result type (and `EditPayload` through
//! `Transaction`), and the sequencer's two message enums bring its wire
//! types. A new type reachable from none of them must be added explicitly.
//! Struct and field `///` docs are copied into the output. CI fails when the
//! committed bindings differ from a fresh run.

use gents::FileGroup;
use logisheets_rs::{AsyncFuncResult, BlockSortOrder, DisplayWindowRequest};

fn main() {
    // Relative to the working directory: run from the repo root.
    let path = "packages/web/src/bindings";
    let mut file_group = FileGroup::new();
    file_group.add::<DisplayWindowRequest>();
    file_group.add::<AsyncFuncResult>();
    file_group.add::<BlockSortOrder>();

    use logisheets_sequencer::{SequencerMessage, UserMessage};
    file_group.add::<SequencerMessage>();
    file_group.add::<UserMessage>();

    // RPC types - params and interface
    use logisheets_rs::rpc::WorkbookMethods;
    file_group.add_rpc::<WorkbookMethods>();

    file_group.gen_files(path, true);
}
