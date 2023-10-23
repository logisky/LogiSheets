use logisheets_controller::EditAction;

pub type FileId = String;

pub type UserId = String;

/// Join to edit the file.
#[derive(Debug)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "msg_join.ts", rename_all = "camelCase")
)]
pub struct Join {
    pub file: FileId,
    pub user: UserId,
    // The first join message of a workbook can
    // contain a file data here. If not, use a new workbook.
    pub wb_file: Option<WorkbookFile>,
}

#[derive(Debug)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "workbook_file.ts", rename_all = "camelCase")
)]
pub struct WorkbookFile {
    pub data: Vec<u8>,
    pub name: String,
}

#[derive(Debug)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "msg_edit.ts", rename_all = "camelCase")
)]
pub struct Edit {
    // The version which users' action is based on.
    pub version: u32,
    pub file: FileId,
    pub user: UserId,
    pub action: EditAction,
}

#[derive(Debug)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "msg_user_message.ts", rename_all = "camelCase")
)]
pub enum UserMessage {
    Join(Join),
    Edit(Edit),
}

/// Users will receive this message to update its local file.
#[derive(Debug)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(
        file_name = "msg_sequencer_action_message.ts",
        rename_all = "camelCase"
    )
)]
pub struct SequencerActionMessage {
    pub version: u32,
    pub user_id: UserId,
    pub file_id: FileId,
    pub action: EditAction,
}

/// If users' action is conflicted with others', this action will not be executed
/// and this message will be sent to this user only.
#[derive(Debug)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(
        file_name = "msg_sequencer_action_invalid_message.ts",
        rename_all = "camelCase"
    )
)]
pub struct SequencerActionInvalidMessage {
    pub version: u32,
    pub user_id: UserId,
    pub file_id: FileId,
    pub reason: String,
}

/// The reponse message for users' `Join` message.
#[derive(Debug)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "msg_sequencer_init_workbook.ts", rename_all = "camelCase")
)]
pub struct SequencerInitWorkbook {
    pub version: u32,
    pub file_id: FileId,
    // If None, it means this message is sent to the first user for this room, who
    // sent the workbook data just now. So sequenser has no need to send it back again.
    pub data: Option<Vec<u8>>,
}

#[derive(Debug)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "msg_sequencer_message.ts", rename_all = "camelCase")
)]
pub enum SequencerMessage {
    InvalidAction(SequencerActionInvalidMessage),
    Action(SequencerActionMessage),
    Join(SequencerInitWorkbook),
}
