use crate::edit_action::{
    AddComment, AuthorInput, CommentMention, CreateBlock, DeleteCellImage, DeleteComment,
    EditComment, EditPayload, LineStyleUpdate, ModifyPolicy, PayloadsAction, ResolveComment,
    SetCellImage, SheetRename, StyleUpdateType, WorkbookUpdateType,
};

use super::{EditAction, Workbook};

#[test]
fn cell_image_round_trip() {
    use crate::image_manager::base64;

    // A tiny 1x1 transparent PNG.
    let png: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01, 0x02, 0x03, 0xFD, 0xFE, 0xFF,
    ];
    let data_b64 = base64::encode(png);

    let mut wb = Workbook::default();
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::SetCellImage(SetCellImage {
            sheet_idx: 0,
            row: 2,
            col: 3,
            image_id: "img-a".to_string(),
            format: "png".to_string(),
            data: data_b64.clone(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(matches!(effect.status, crate::edit_action::StatusCode::Ok(_)));

    // The image is visible via the display API.
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let imgs = ws.get_cell_images();
    assert_eq!(imgs.len(), 1);
    assert_eq!((imgs[0].row, imgs[0].col), (2, 3));
    assert_eq!(imgs[0].format, "png");
    assert_eq!(base64::decode(&imgs[0].data).unwrap(), png);
    drop(ws);

    // Save to xlsx and reload — the image survives the round trip.
    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    let ws2 = wb2.get_sheet_by_idx(0).unwrap();
    let imgs2 = ws2.get_cell_images();
    assert_eq!(imgs2.len(), 1, "image should survive save/load");
    assert_eq!((imgs2[0].row, imgs2[0].col), (2, 3));
    assert_eq!(imgs2[0].format, "png");
    assert_eq!(base64::decode(&imgs2[0].data).unwrap(), png);

    // Undo removes it.
    wb.handle_action(EditAction::Undo);
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert_eq!(ws.get_cell_images().len(), 0, "undo should remove the image");
    drop(ws);

    // Delete payload also removes it (redo first to bring it back).
    wb.handle_action(EditAction::Redo);
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::DeleteCellImage(DeleteCellImage {
            sheet_idx: 0,
            row: 2,
            col: 3,
        })],
        undoable: true,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert_eq!(ws.get_cell_images().len(), 0, "delete should remove the image");
}

#[test]
fn new_workbook() {
    let mut wb = Workbook::default();
    let ws = wb.get_sheet_by_idx(0).unwrap();

    ws.get_cell_position(100, 100).unwrap();

    let empty_display_window = ws.get_display_window(0, 0, 100, 100).unwrap();
    let row_cnt = empty_display_window.rows.len();
    let col_cnt = empty_display_window.cols.len();
    let cell_cnt = empty_display_window.cells.len();
    assert!(row_cnt >= 100);
    assert!(col_cnt >= 100);
    assert_eq!(row_cnt * col_cnt, cell_cnt);
    assert_eq!(empty_display_window.rows[0].idx, 0);
    assert_eq!(empty_display_window.cols[0].idx, 0);

    let empty_display_resp = ws.get_display_window_response(0., 0., 100., 100.).unwrap();
    assert!(empty_display_resp.window.cells.len() > 0);
    assert!(empty_display_resp.window.rows.len() > 0);
    assert!(empty_display_resp.window.cols.len() > 0);

    assert_eq!(empty_display_resp.window.rows.get(0).unwrap().idx, 0);
    assert_eq!(empty_display_resp.window.cols.get(0).unwrap().idx, 0);
    let v = empty_display_resp
        .window
        .cols
        .into_iter()
        .fold(0., |p, c| return p + c.width);
    assert!(v > 100.);

    let result = wb.handle_action(crate::EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::SheetRename(SheetRename {
            old_name: Some("Sheet1".to_string()),
            new_name: "abcd".to_string(),
            idx: None,
        })],
        undoable: true,
        init: false,
    }));

    match result.status {
        crate::edit_action::StatusCode::Ok(workbook_update_type) => {
            println!("{:?}", workbook_update_type);
            assert!(matches!(workbook_update_type, WorkbookUpdateType::Sheet));
        }
        crate::edit_action::StatusCode::Err(e) => panic!("{:?}", e),
    }
}

#[test]
fn create_block() {
    let mut wb = Workbook::default();
    let id = wb.get_available_block_id(0).unwrap();
    let payload_action = PayloadsAction {
        payloads: vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id,
            master_row: 1,
            master_col: 1,
            row_cnt: 3,
            col_cnt: 3,
            owner: None,
            modify_policy: None,
        })],
        undoable: false,
        init: false,
    };
    let _ = wb.handle_action(EditAction::Payloads(payload_action));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let _ = ws.get_display_window(0, 0, 10, 10).unwrap();
    ws.get_cell_position(1, 1).unwrap();
    ws.get_cell_position(3, 3).unwrap();
    let resp = ws.get_display_window_response(0., 0., 100., 100.).unwrap();
    assert_eq!(resp.window.blocks.len(), 1);
}

#[test]
fn get_col_style() {
    let mut wb = Workbook::default();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::LineStyleUpdate(LineStyleUpdate {
            sheet_idx: 0,
            from: 0,
            to: 1,
            row: true,
            ty: StyleUpdateType {
                set_num_fmt: Some("0.00".to_string()),
                ..Default::default()
            },
        })],
        undoable: true,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let style = ws.get_style(0, 0).unwrap();
    assert_eq!(style.formatter, "0.00");
}

#[test]
fn overwrite_formula_with_plain_value() {
    use crate::controller::display::Value;
    use crate::edit_action::CellInput;

    let mut wb = Workbook::default();

    // Write a formula into A1.
    let r = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: "=1+1".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(matches!(r.status, crate::edit_action::StatusCode::Ok(_)));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert_eq!(ws.get_formula(0, 0).unwrap(), "1 + 1");
    assert!(matches!(ws.get_value(0, 0).unwrap(), Value::Number(n) if (n - 2.0).abs() < 1e-9));

    // Overwrite with a plain number. The formula must be cleared,
    // otherwise the next recalc re-evaluates 1+1 over the typed "5".
    let r = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: "5".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(matches!(r.status, crate::edit_action::StatusCode::Ok(_)));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert_eq!(ws.get_formula(0, 0).unwrap(), "");
    match ws.get_value(0, 0).unwrap() {
        Value::Number(n) => assert!((n - 5.0).abs() < 1e-9, "got {}", n),
        v => panic!("expected Number(5), got {:?}", v),
    }
}

#[test]
fn test_check_formula() {
    let wb = Workbook::new();
    let r = wb.check_formula("=1+1".to_string());
    assert!(r);

    let r = wb.check_formula("=SUM(1)+".to_string());
    assert!(!r);
}

#[test]
fn create_block_with_owner_and_policy_roundtrip() {
    // Create a workbook with a block carrying an owner and a non-default policy,
    // save to .xlsx bytes, reload, and verify the metadata survives the round trip.
    let mut wb = Workbook::default();
    let id = wb.get_available_block_id(0).unwrap();
    let payload_action = PayloadsAction {
        payloads: vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id,
            master_row: 1,
            master_col: 1,
            row_cnt: 2,
            col_cnt: 2,
            owner: Some("what-if-calculator".to_string()),
            modify_policy: Some(ModifyPolicy::OwnerAndUser),
        })],
        undoable: false,
        init: false,
    };
    let _ = wb.handle_action(EditAction::Payloads(payload_action));

    let bytes = wb.save().expect("save");
    let reloaded = Workbook::from_file(&bytes, "roundtrip.xlsx".to_string()).expect("reload");

    let info = reloaded
        .get_block_modify_info(0, id)
        .expect("block missing after reload");
    assert_eq!(info.owner, "what-if-calculator");
    assert!(matches!(info.modify_policy, ModifyPolicy::OwnerAndUser));
}

fn author(name: &str) -> AuthorInput {
    AuthorInput {
        display_name: name.to_string(),
        user_id: None,
        provider_id: None,
    }
}

fn enterprise_author(name: &str, user_id: &str) -> AuthorInput {
    AuthorInput {
        display_name: name.to_string(),
        user_id: Some(user_id.to_string()),
        provider_id: Some("AD".to_string()),
    }
}

#[test]
fn comment_thread_add_reply_mention_edit_delete() {
    let mut wb = Workbook::default();

    // Root comment authored by Alice, mentioning Bob (an enterprise user).
    let root_id = "{root-0000-0000-0000-000000000001}".to_string();
    let bob = enterprise_author("Bob", "bob@corp.com");
    let r = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::AddComment(AddComment {
            sheet_idx: 0,
            row: 2,
            col: 3,
            comment_id: root_id.clone(),
            parent_id: None,
            author: enterprise_author("Alice", "alice@corp.com"),
            dt: "2026-07-03T10:00:00Z".to_string(),
            content: "Please review @Bob".to_string(),
            mentions: vec![CommentMention {
                start: 15,
                len: 4,
                author: bob.clone(),
                mention_id: None,
            }],
        })],
        undoable: true,
        init: false,
    }));
    assert!(matches!(r.status, crate::edit_action::StatusCode::Ok(_)));

    // Reply authored by Bob.
    let reply_id = "{reply-0000-0000-0000-000000000002}".to_string();
    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::AddComment(AddComment {
            sheet_idx: 0,
            row: 2,
            col: 3,
            comment_id: reply_id.clone(),
            parent_id: Some(root_id.clone()),
            author: bob.clone(),
            dt: "2026-07-03T10:05:00Z".to_string(),
            content: "Done".to_string(),
            mentions: vec![],
        })],
        undoable: true,
        init: false,
    }));

    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let comment = ws.get_comment(2, 3).expect("comment thread missing");
        assert_eq!(comment.notes.len(), 2);
        let root = &comment.notes[0];
        assert_eq!(root.author.display_name, "Alice");
        assert_eq!(root.author.user_id.as_deref(), Some("alice@corp.com"));
        assert_eq!(root.mentions.len(), 1);
        assert_eq!(root.mentions[0].person.display_name, "Bob");
        assert!(root.parent_id.is_none());
        let reply = &comment.notes[1];
        assert_eq!(reply.author.display_name, "Bob");
        assert_eq!(reply.parent_id.as_deref(), Some(root_id.as_str()));
        // Alice + Bob mentioned/authored, so at least 2 sheet comments? Only one thread.
        assert_eq!(ws.get_comments().len(), 1);
    }

    // Edit the root note's text.
    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::EditComment(EditComment {
            sheet_idx: 0,
            comment_id: root_id.clone(),
            content: "Reviewed, thanks".to_string(),
            mentions: vec![],
        })],
        undoable: true,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let comment = ws.get_comment(2, 3).unwrap();
        assert_eq!(comment.notes[0].content, "Reviewed, thanks");
        assert_eq!(comment.notes[0].mentions.len(), 0);
    }

    // Resolve the thread.
    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::ResolveComment(ResolveComment {
            sheet_idx: 0,
            comment_id: root_id.clone(),
            resolved: true,
        })],
        undoable: true,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(ws.get_comment(2, 3).unwrap().notes[0].resolved);
    }

    // Delete the reply only — root should remain.
    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::DeleteComment(DeleteComment {
            sheet_idx: 0,
            comment_id: reply_id.clone(),
        })],
        undoable: true,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert_eq!(ws.get_comment(2, 3).unwrap().notes.len(), 1);
    }

    // Deleting the root removes the whole thread.
    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::DeleteComment(DeleteComment {
            sheet_idx: 0,
            comment_id: root_id.clone(),
        })],
        undoable: true,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(ws.get_comment(2, 3).is_none());
    }
}

#[test]
fn comment_roundtrip_persists_thread_and_persons() {
    let mut wb = Workbook::default();
    let root_id = "{root-0000-0000-0000-0000000000aa}".to_string();
    let reply_id = "{reply-0000-0000-0000-0000000000bb}".to_string();
    let bob = enterprise_author("Bob", "bob@corp.com");

    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::AddComment(AddComment {
                sheet_idx: 0,
                row: 5,
                col: 1,
                comment_id: root_id.clone(),
                parent_id: None,
                author: author("Guest"),
                dt: "2026-07-03T12:00:00Z".to_string(),
                content: "cc @Bob".to_string(),
                mentions: vec![CommentMention {
                    start: 3,
                    len: 4,
                    author: bob.clone(),
                    mention_id: None,
                }],
            }),
            EditPayload::AddComment(AddComment {
                sheet_idx: 0,
                row: 5,
                col: 1,
                comment_id: reply_id.clone(),
                parent_id: Some(root_id.clone()),
                author: bob.clone(),
                dt: "2026-07-03T12:01:00Z".to_string(),
                content: "ack".to_string(),
                mentions: vec![],
            }),
        ],
        undoable: false,
        init: false,
    }));

    let bytes = wb.save().expect("save");
    let reloaded = Workbook::from_file(&bytes, "comments.xlsx".to_string()).expect("reload");
    let ws = reloaded.get_sheet_by_idx(0).unwrap();
    let comment = ws.get_comment(5, 1).expect("thread lost on reload");
    assert_eq!(comment.notes.len(), 2);
    assert_eq!(comment.notes[0].content, "cc @Bob");
    assert_eq!(comment.notes[0].mentions.len(), 1);
    // The mentioned person's directory identity survived the round trip.
    assert_eq!(
        comment.notes[0].mentions[0].person.user_id.as_deref(),
        Some("bob@corp.com")
    );
    assert_eq!(
        comment.notes[1].parent_id.as_deref(),
        Some(root_id.as_str())
    );
    assert_eq!(comment.notes[1].author.display_name, "Bob");
}
