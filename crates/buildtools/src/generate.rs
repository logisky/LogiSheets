fn main() {
    use gents::FileGroup;
    use logisheets_controller::controller::display::DisplayWindowWithStartPoint;
    use logisheets_controller::controller::display::{DisplayRequest, DisplayResponse, SheetInfo};
    use logisheets_controller::edit_action::AsyncFuncResult;
    use logisheets_controller::edit_action::{ActionEffect, EditAction};
    use logisheets_controller::CellInfo;
    use logisheets_controller::ErrorMessage;

    let path = "packages/web/src/bindings";
    let mut file_group = FileGroup::new();
    file_group.add::<DisplayRequest>();
    file_group.add::<DisplayResponse>();
    file_group.add::<DisplayWindowWithStartPoint>();
    file_group.add::<EditAction>();
    file_group.add::<SheetInfo>();
    file_group.add::<ActionEffect>();
    file_group.add::<AsyncFuncResult>();

    file_group.add::<CellInfo>();
    file_group.add::<ErrorMessage>();

    use logisheets_sequencer::{SequencerMessage, UserMessage};
    file_group.add::<SequencerMessage>();
    file_group.add::<UserMessage>();

    file_group.gen_files(path, true);
}
