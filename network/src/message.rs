use actix::{Message, Recipient};
use xlrs_controller::{AsyncCalcResult, CellId, SheetId, Task};

use crate::text_dsl::{self, build_join_edit};

pub type FileId = String;
pub type UserId = String;

#[derive(Debug, Clone, Message)]
#[rtype(result = "()")]
pub struct ServerMessage {
    pub content: Vec<u8>,
}

#[derive(Debug, Clone, Message)]
#[rtype(result = "()")]
pub struct JoinEdit {
    pub file_id: FileId,
    pub user_id: UserId,
    pub recipient: Recipient<ServerMessage>,
}

impl JoinEdit {
    pub fn from_text(t: &str, recipient: Recipient<ServerMessage>) -> Option<Self> {
        build_join_edit(t, recipient)
    }
}

#[derive(Debug, Clone, Message)]
#[rtype(result = "()")]
pub struct LeaveEdit {
    pub file_id: FileId,
    pub user_id: UserId,
}

#[derive(Debug, Clone, Message)]
#[rtype(result = "()")]
pub struct ApplyEdit {
    pub content: Vec<u8>,
}

impl ApplyEdit {
    pub fn from_bytes(bytes: bytes::Bytes) -> Self {
        ApplyEdit {
            content: bytes.to_vec(),
        }
    }

    pub fn from_text(text: String) -> Option<Self> {
        text_dsl::build_apply_edit_binary(&text)
    }
}

#[derive(Debug, Message)]
#[rtype(result = "()")]
pub struct CalcAsyncTask {
    pub file_id: String,
    pub tasks: Vec<Task>,
    pub dirtys: Vec<(SheetId, CellId)>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct CalcAsyncResult {
    pub tasks: Vec<Task>,
    pub res: Vec<AsyncCalcResult>,
    pub file_id: String,
    pub dirtys: Vec<(SheetId, CellId)>,
}
