use gents::FileGroup;
use logisheets_controller::controller::display::{
    BlockField, CellCoordinate, CellPosition, DisplayWindowRequest, DisplayWindowWithStartPoint,
    ShadowCellInfo, SheetInfo,
};
use logisheets_controller::edit_action::{ActionEffect, AsyncFuncResult, EditAction};
use logisheets_controller::{
    AppendixWithCell, CellInfo, ErrorMessage, FormulaDisplayInfo, SaveFileResult, SheetDimension,
};
use logisheets_server_types::{CraftData, CraftDescriptor, Resp};

fn main() {
    let path = "packages/web/src/bindings";
    let mut file_group = FileGroup::new();
    file_group.add::<DisplayWindowRequest>();
    file_group.add::<CellCoordinate>();
    file_group.add::<CellPosition>();
    file_group.add::<DisplayWindowWithStartPoint>();
    file_group.add::<EditAction>();
    file_group.add::<SheetInfo>();
    file_group.add::<ActionEffect>();
    file_group.add::<AsyncFuncResult>();
    file_group.add::<SheetDimension>();
    file_group.add::<AppendixWithCell>();
    file_group.add::<SaveFileResult>();

    file_group.add::<FormulaDisplayInfo>();

    file_group.add::<CellInfo>();
    file_group.add::<BlockField>();
    file_group.add::<ErrorMessage>();
    file_group.add::<ShadowCellInfo>();

    use logisheets_sequencer::{SequencerMessage, UserMessage};
    file_group.add::<SequencerMessage>();
    file_group.add::<UserMessage>();

    file_group.gen_files(path, true);

    let path = "packages/craft-forge/src/bindings";
    let mut file_group = FileGroup::new();
    file_group.add::<CraftDescriptor>();
    file_group.add::<CraftData>();
    file_group.add::<Resp<u8>>();
    file_group.gen_files(path, true);
}
