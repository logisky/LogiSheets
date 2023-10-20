use gents_derives::TS;
use logisheets_controller::EditAction;

pub type FileId = String;

pub type UserId = String;

/// Join to edit the file.
#[derive(Debug, TS)]
#[ts(file_name = "msg_join.ts", rename_all = "camelCase")]
pub struct Join {
    pub file: FileId,
    pub user: UserId,
    // The first join message of a workbook can
    // contain a file data here. If not, use a new workbook.
    pub wb: Option<Vec<u8>>,
}

#[derive(Debug, TS)]
#[ts(file_name = "msg_edit.ts", rename_all = "camelCase")]
pub struct Edit {
    // The version which users' action is based on.
    pub version: u32,
    pub file: FileId,
    pub user: UserId,
    pub action: EditAction,
}

#[derive(Debug, TS)]
#[ts(file_name = "msg_user_message.ts", rename_all = "camelCase")]
pub enum UserMessage {
    Join(Join),
    Edit(Edit),
}

/// Users will receive this message to update its local file.
#[derive(Debug, TS)]
#[ts(
    file_name = "msg_sequencer_action_message.ts",
    rename_all = "camelCase"
)]
pub struct SequencerActionMessage {
    pub version: u32,
    pub user_id: UserId,
    pub file_id: FileId,
    pub action: EditAction,
}

/// If users' action is conflicted with others', this action will not be executed
/// and this message will be sent to this user only.
#[derive(Debug, TS)]
#[ts(
    file_name = "msg_sequencer_action_invalid_message.ts",
    rename_all = "camelCase"
)]
pub struct SequencerActionInvalidMessage {
    pub version: u32,
    pub user_id: UserId,
    pub file_id: FileId,
    pub reason: String,
}

#[derive(Debug, TS)]
#[ts(file_name = "msg_sequencer_message.ts", rename_all = "camelCase")]
pub enum SequencerMessage {
    InvalidAction(SequencerActionInvalidMessage),
    Action(SequencerActionMessage),
}
