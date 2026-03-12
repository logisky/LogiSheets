use gents::FileGroup;
use logisheets_rs::{AsyncFuncResult, DisplayWindowRequest};

fn main() {
    let path = "packages/web/src/bindings";
    let mut file_group = FileGroup::new();
    file_group.add::<DisplayWindowRequest>();
    file_group.add::<AsyncFuncResult>();

    use logisheets_sequencer::{SequencerMessage, UserMessage};
    file_group.add::<SequencerMessage>();
    file_group.add::<UserMessage>();

    // RPC types - params and interface
    use logisheets_wasm_server::rpc::WorkbookMethods;
    file_group.add_rpc::<WorkbookMethods>();

    file_group.gen_files(path, true);
}
