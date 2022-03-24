use super::{fill_manager::FillPayload, StyleManager};
use crate::{
    payloads::sheet_process::style::CellStylePayload,
    style_manager::{border_manager::BorderPayload, font_manager::FontPayload},
};
use controller_base::StyleId;

pub fn execute_style_payload(
    sm: StyleManager,
    payload: &CellStylePayload,
    id: StyleId,
) -> Option<(StyleManager, StyleId)> {
    log!("style payload executing: {:?}", payload);
    let StyleManager {
        mut font_manager,
        mut border_manager,
        mut cell_xfs_manager,
        cell_style_xfs_manager,
        mut fill_manager,
        num_fmt_manager,
    } = sm;
    let mut xf = cell_xfs_manager.get_data(id)?.clone();
    match payload {
        CellStylePayload::Font(fp) => {
            let p = FontPayload {
                id: xf.font_id.unwrap_or(0),
                change: fp.clone(),
            };
            let (new_manager, fid) = font_manager.execute(&p);
            xf.font_id = Some(fid);
            xf.apply_font = Some(true);
            font_manager = new_manager;
        }
        CellStylePayload::Border(bp) => {
            let p = BorderPayload {
                id: xf.border_id.unwrap_or(0),
                change: bp.clone(),
            };
            let (new_manager, sid) = border_manager.execute(&p);
            xf.border_id = Some(sid);
            xf.apply_border = Some(true);
            border_manager = new_manager;
        }
        CellStylePayload::Fill(fp) => {
            let p = FillPayload {
                id: xf.fill_id.unwrap_or(0),
                change: fp.clone(),
            };
            let (new_manager, fid) = fill_manager.execute(&p);
            xf.fill_id = Some(fid);
            xf.apply_fill = Some(true);
            fill_manager = new_manager;
        }
    };
    let new_id = cell_xfs_manager.get_id(&xf);
    let manager = StyleManager {
        font_manager,
        border_manager,
        cell_xfs_manager,
        cell_style_xfs_manager,
        fill_manager,
        num_fmt_manager,
    };
    Some((manager, new_id))
}
