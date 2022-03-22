use crate::message::{ApplyEdit, JoinEdit, ServerMessage};
use actix::Recipient;
use logisheets_protocols::message::EventSource;
use logisheets_protocols::message::{
    client_send::ClientSendOneof, payload::PayloadOneof, CellInput, ClientSend, ColumnShift,
    CreateBlock, DisplayRequest, LineShiftInBlock, MoveBlock, Payload, RowShift, SetColWidth,
    SetRowHeight, SheetShift, ShiftType, Transaction,
};
use logisheets_protocols::serialize_client_message;
use std::str::Split;

/// This module is used to simulate client message. It can be used in testing
/// LogiSheets backend.
/// Before editing, you should tell the server who you are and which file you are
/// going to edit. You should send the join request message first.
/// Join request format: join:{user_id}:{file_id}
/// Edit request format: {user_id}||{file_id}||{content}
/// DisplayArea request: "displayrequest||{sheet_idx}||{version}"
/// Undo request: "undo"
/// Redo request: "redo"
/// Transaction request: "transaction-{content}"
/// Transaction uses '\n' to split the payloads, and payload defined as below:
/// CellInput: "input|{sheet_idx}|{row_idx}|{col_idx}|{content}"
/// RowShift: "{insertrow or deleterow}|{sheet_idx}|{start}|{count}"
/// ColShift: "{insertcol or deletecol}|{sheet_idx}|{start}|{count}"
/// SheetShift: "{insertsheet or deletesheet}|{idx}"
/// CreateBlock: "createblock|{sheet_idx}|{id}|{row}|{col}|{row_cnt}|{row_cnt}"
/// MoveBlock: "moveblock|{sheet_idx}|{id}|{new_row}|{new_col}"
/// LineShiftInBlocks: "lineshiftinblock|{sheet_idx}|{id}|{idx}|{cnt}|{horizontal or vertical}|{insert or remove}"
/// SetRowHeight: "setrowheight|{sheet_idx}|{idx}|{height}"
/// SetColWidth: "setcolwidth|{sheet_idx}|{idx}|{width}"
pub fn build_join_edit(text: &str, recipient: Recipient<ServerMessage>) -> Option<JoinEdit> {
    let mut iter = text.split(":");
    let first = iter.next()?;
    match first {
        "join" => {
            let user_id = iter.next()?.to_owned();
            let file_id = iter.next()?.to_owned();
            Some(JoinEdit {
                file_id,
                user_id,
                recipient,
            })
        }
        _ => None,
    }
}

pub fn build_apply_edit_binary(text: &str) -> Option<ApplyEdit> {
    let mut iter = text.split("||");
    let user_id = iter.next()?.to_owned();
    let file_id = iter.next()?.to_owned();
    let command = iter.next()?;
    let cs = match command {
        "displayrequest" => {
            let sheet_idx = convert(iter.next()?.parse::<u32>())?;
            let version = convert(iter.next()?.parse::<u32>())?;
            let display_area = DisplayRequest { sheet_idx, version };
            Some(ClientSend {
                event_source: Some(EventSource {
                    user_id,
                    action_id: String::from(""),
                }),
                file_id,
                client_send_oneof: Some(ClientSendOneof::DisplayRequest(display_area)),
            })
        }
        "transaction" => {
            let payloads_str = iter.next()?;
            let payloads = build_payloads(payloads_str);
            let t = Transaction {
                payloads,
                undo: false,
                redo: false,
                undoable: false,
            };
            Some(ClientSend {
                event_source: Some(EventSource {
                    user_id,
                    action_id: String::from(""),
                }),
                file_id,
                client_send_oneof: Some(ClientSendOneof::Transaction(t)),
            })
        }
        "undo" => {
            let t = Transaction {
                undo: true,
                payloads: vec![],
                redo: false,
                undoable: false,
            };
            Some(ClientSend {
                event_source: Some(EventSource {
                    user_id,
                    action_id: String::from(""),
                }),
                file_id,
                client_send_oneof: Some(ClientSendOneof::Transaction(t)),
            })
        }
        "redo" => {
            let t = Transaction {
                undo: false,
                payloads: vec![],
                redo: true,
                undoable: false,
            };
            Some(ClientSend {
                event_source: Some(EventSource {
                    user_id,
                    action_id: String::from(""),
                }),
                file_id,
                client_send_oneof: Some(ClientSendOneof::Transaction(t)),
            })
        }
        _ => None,
    }?;
    let buf = serialize_client_message(cs);
    Some(ApplyEdit { content: buf })
}

fn build_payloads(p: &str) -> Vec<Payload> {
    let mut res = vec![];
    let iter = p.split("\n");
    iter.map(|s| build_payload(s))
        .for_each(|payload| match payload {
            Some(p) => res.push(p),
            None => {}
        });
    res
}

fn build_payload(p: &str) -> Option<Payload> {
    let mut iter = p.split("|");
    let cmd = iter.next()?;
    let get_next_three = |iter: &mut Split<&str>| -> Option<(u32, u32, u32)> {
        let first = convert(iter.next()?.parse::<u32>())?;
        let second = convert(iter.next()?.parse::<u32>())?;
        let third = convert(iter.next()?.parse::<u32>())?;
        Some((first, second, third))
    };
    match cmd {
        "input" => {
            let (sheet_idx, row, col) = get_next_three(&mut iter)?;
            let input = iter.next()?.to_owned();
            let cell_input = CellInput {
                sheet_idx,
                row,
                col,
                input,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::CellInput(cell_input)),
            })
        }
        "insertrow" => {
            let (sheet_idx, start, count) = get_next_three(&mut iter)?;
            let row_shift = RowShift {
                sheet_idx,
                start,
                count,
                r#type: ShiftType::Insert as i32,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::RowShift(row_shift)),
            })
        }
        "deleterow" => {
            let (sheet_idx, start, count) = get_next_three(&mut iter)?;
            let row_shift = RowShift {
                sheet_idx,
                start,
                count,
                r#type: ShiftType::Delete as i32,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::RowShift(row_shift)),
            })
        }
        "insertcol" => {
            let (sheet_idx, start, count) = get_next_three(&mut iter)?;
            let col_shift = ColumnShift {
                sheet_idx,
                start,
                count,
                r#type: ShiftType::Insert as i32,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::ColumnShift(col_shift)),
            })
        }
        "deletecol" => {
            let (sheet_idx, start, count) = get_next_three(&mut iter)?;
            let col_shift = ColumnShift {
                sheet_idx,
                start,
                count,
                r#type: ShiftType::Delete as i32,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::ColumnShift(col_shift)),
            })
        }
        "insertsheet" => {
            let sheet_idx = convert(iter.next()?.parse::<u32>())?;
            let sheet_shift = SheetShift {
                sheet_idx,
                r#type: ShiftType::Insert as i32,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::SheetShift(sheet_shift)),
            })
        }
        "deletesheet" => {
            let sheet_idx = convert(iter.next()?.parse::<u32>())?;
            let sheet_shift = SheetShift {
                sheet_idx,
                r#type: ShiftType::Delete as i32,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::SheetShift(sheet_shift)),
            })
        }
        "createblock" => {
            let (sheet_idx, id, row) = get_next_three(&mut iter)?;
            let (col, row_cnt, col_cnt) = get_next_three(&mut iter)?;
            let p = CreateBlock {
                sheet_idx,
                id,
                master_row: row,
                master_col: col,
                row_cnt,
                col_cnt,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::CreateBlock(p)),
            })
        }
        "moveblock" => {
            let sheet_idx = convert(iter.next()?.parse::<u32>())?;
            let (id, new_row, new_col) = get_next_three(&mut iter)?;
            let p = MoveBlock {
                sheet_idx,
                id,
                new_master_row: new_row,
                new_master_col: new_col,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::MoveBlock(p)),
            })
        }
        "lineshiftinblock" => {
            let sheet_idx = convert(iter.next()?.parse::<u32>())?;
            let (id, idx, cnt) = get_next_three(&mut iter)?;
            let horizontal = match iter.next() {
                Some("horizontal") => Some(true),
                Some("vertical") => Some(false),
                _ => None,
            }?;
            let insert = match iter.next() {
                Some("insert") => Some(true),
                Some("remove") => Some(false),
                _ => None,
            }?;
            let p = LineShiftInBlock {
                sheet_idx,
                id,
                idx,
                cnt,
                horizontal,
                insert,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::LineShiftInBlock(p)),
            })
        }
        "setrowheight" => {
            let sheet_idx = convert(iter.next()?.parse::<u32>())?;
            let row = convert(iter.next()?.parse::<u32>())?;
            let height = convert(iter.next()?.parse::<f64>())?;
            let p = SetRowHeight {
                sheet_idx,
                row,
                height,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::SetRowHeight(p)),
            })
        }
        "setcolwidth" => {
            let sheet_idx = convert(iter.next()?.parse::<u32>())?;
            let col = convert(iter.next()?.parse::<u32>())?;
            let width = convert(iter.next()?.parse::<f64>())?;
            let p = SetColWidth {
                sheet_idx,
                col,
                width,
            };
            Some(Payload {
                payload_oneof: Some(PayloadOneof::SetColWidth(p)),
            })
        }
        _ => None,
    }
}

fn convert<T, U>(res: Result<T, U>) -> Option<T> {
    match res {
        Ok(n) => Some(n),
        Err(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::build_apply_edit_binary;
    use logisheets_protocols::message::EventSource;
    use logisheets_protocols::message::{
        client_send::ClientSendOneof, payload::PayloadOneof, CellInput, ClientSend, ColumnShift,
        DisplayRequest, Payload, RowShift, ShiftType, Transaction,
    };
    use logisheets_protocols::serialize_client_message;

    #[test]
    fn undo_test() {
        let text = "user||file||undo";
        let bin = build_apply_edit_binary(text);
        match bin {
            Some(e) => {
                let t = Transaction {
                    undo: true,
                    payloads: vec![],
                    redo: false,
                    undoable: false,
                };
                let cs = ClientSend {
                    event_source: Some(EventSource {
                        user_id: String::from("user"),
                        action_id: String::from(""),
                    }),
                    file_id: "file".to_string(),
                    client_send_oneof: Some(ClientSendOneof::Transaction(t)),
                };
                let buf = serialize_client_message(cs);
                assert_eq!(buf, e.content);
            }
            None => panic!(),
        }
    }

    #[test]
    fn redo_test() {
        let text = "user||file||redo";
        let e = build_apply_edit_binary(text).unwrap();
        let t = Transaction {
            undo: false,
            payloads: vec![],
            redo: true,
            undoable: false,
        };
        let cs = ClientSend {
            event_source: Some(EventSource {
                user_id: String::from("user"),
                action_id: String::from(""),
            }),
            file_id: "file".to_string(),
            client_send_oneof: Some(ClientSendOneof::Transaction(t)),
        };
        let buf = serialize_client_message(cs);
        assert_eq!(buf, e.content);
    }

    #[test]
    fn display_area_test() {
        let text = "user||file||displayrequest||2||0";
        let e = build_apply_edit_binary(text).unwrap();
        let display_request = DisplayRequest {
            sheet_idx: 2,
            version: 0,
        };
        let cs = ClientSend {
            event_source: Some(EventSource {
                user_id: String::from("user"),
                action_id: String::from(""),
            }),
            file_id: "file".to_string(),
            client_send_oneof: Some(ClientSendOneof::DisplayRequest(display_request)),
        };
        let buf = serialize_client_message(cs);
        assert_eq!(buf, e.content);
    }

    #[test]
    fn transaction_single_payload_test() {
        let text = "user||file||transaction||insertrow|1|2|3";
        let e = build_apply_edit_binary(text).unwrap();
        let row_shift = RowShift {
            sheet_idx: 1,
            start: 2,
            count: 3,
            r#type: ShiftType::Insert as i32,
        };
        let p = Payload {
            payload_oneof: Some(PayloadOneof::RowShift(row_shift)),
        };
        let t = Transaction {
            undo: false,
            payloads: vec![p],
            redo: false,
            undoable: false,
        };
        let cs = ClientSend {
            event_source: Some(EventSource {
                user_id: String::from("user"),
                action_id: String::from(""),
            }),
            file_id: "file".to_string(),
            client_send_oneof: Some(ClientSendOneof::Transaction(t)),
        };
        let buf = serialize_client_message(cs);
        assert_eq!(buf, e.content);
    }

    #[test]
    fn transaction_multi_payloads_test() {
        let text = "user||file||transaction||insertcol|1|2|3\ninput|1|4|5|formula";
        let e = build_apply_edit_binary(text).unwrap();
        let col_shift = ColumnShift {
            sheet_idx: 1,
            start: 2,
            count: 3,
            r#type: ShiftType::Insert as i32,
        };
        let p1 = Payload {
            payload_oneof: Some(PayloadOneof::ColumnShift(col_shift)),
        };
        let cell_input = CellInput {
            sheet_idx: 1,
            row: 4,
            col: 5,
            input: String::from("formula"),
        };
        let p2 = Payload {
            payload_oneof: Some(PayloadOneof::CellInput(cell_input)),
        };
        let t = Transaction {
            undo: false,
            payloads: vec![p1, p2],
            redo: false,
            undoable: false,
        };
        let cs = ClientSend {
            event_source: Some(EventSource {
                user_id: String::from("user"),
                action_id: String::from(""),
            }),
            file_id: "file".to_string(),
            client_send_oneof: Some(ClientSendOneof::Transaction(t)),
        };
        let buf = serialize_client_message(cs);
        assert_eq!(buf, e.content);
    }
}
