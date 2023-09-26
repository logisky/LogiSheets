fn main() {
    use gents::FileGroup;
    use logisheets_controller::controller::display::{DisplayRequest, DisplayResponse};
    use logisheets_controller::controller::edit_action::{ActionEffect, EditAction};
    let path = "src/bindings";
    let mut file_group = FileGroup::new();
    file_group.add::<DisplayRequest>();
    file_group.add::<DisplayResponse>();
    file_group.add::<EditAction>();
    file_group.add::<ActionEffect>();
    file_group.gen_files(path, true);
}
