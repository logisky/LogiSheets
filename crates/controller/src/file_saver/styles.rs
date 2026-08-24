use crate::style_manager::{
    StyleManager, border_manager::BorderManager, fill_manager::FillManager,
    font_manager::FontManager, num_fmt_manager::NumFmtManager, xf_manager::XfManager,
};
use logisheets_workbook::prelude::{
    CtBorders, CtCellStyleXfs, CtCellXfs, CtFills, CtFonts, CtNumFmt, CtNumFmts, StylesheetPart,
};

use super::SaverTrait;

/// A style table as a dense list, so an entry's POSITION equals its id.
///
/// Every style id is written into the file as an INDEX — `s="4"` on a cell,
/// `fontId="2"` on an xf — so position and id have to agree. They did for as
/// long as ids arrived contiguous from a file, and stopped agreeing the moment an
/// unreferenced entry was collected: the sorted list closed the gap, every index
/// past it shifted by one, and cells came back looking different. On
/// `tests/6.xlsx` a cell went from not-bold-and-black to bold-and-coloured on the
/// SECOND save, the first having been correct.
///
/// Filling the gaps keeps the invariant true for any id that gets written,
/// rather than correcting the handful of places that currently write one and
/// hoping the next author notices. A gap is unreferenced by construction — it
/// was collected because nothing pointed at it — so what fills it only has to be
/// valid.
fn dense_by_id<T: Clone>(items: Vec<(u32, T)>) -> Vec<T> {
    let Some(filler) = items.first().map(|(_, v)| v.clone()) else {
        return Vec::new();
    };
    let max = items.iter().map(|(i, _)| *i).max().unwrap_or(0);
    let mut out = vec![filler; max as usize + 1];
    for (id, v) in items {
        out[id as usize] = v;
    }
    out
}

pub fn save_sheet_style<S: SaverTrait>(manager: &StyleManager, _: &mut S) -> StylesheetPart {
    let fonts = save_fonts(&manager.font_manager);
    let fills = save_fills(&manager.fill_manager);
    let borders = save_borders(&manager.border_manager);
    let num_fmts = save_num_fmts(&manager.num_fmt_manager);
    let cell_style_xfs = save_cell_style_xfs(&manager.cell_style_xfs_manager);
    let cell_xfs = save_cell_xfs(&manager.cell_xfs_manager);
    StylesheetPart {
        num_fmts,
        fonts,
        fills,
        borders,
        cell_style_xfs,
        cell_xfs,
        cell_styles: None,
        // Preserved in load order so every retained `dxfId` (conditional
        // formatting, table styles) still resolves.
        dxfs: manager.dxf_manager.to_ct_dxfs(),
        table_styles: None,
        colors: None,
        ext_lst: None,
    }
}

fn save_cell_style_xfs(manager: &XfManager) -> Option<CtCellStyleXfs> {
    let xfs: Vec<_> = dense_by_id(manager.get_data_with_id_sorted_by_id())
        .into_iter()
        .map(|ctrl_xf| ctrl_xf.to_ct_xf())
        .collect();
    let count = xfs.len() as u32;
    if count > 0 {
        Some(CtCellStyleXfs { count, xfs })
    } else {
        None
    }
}

fn save_cell_xfs(manager: &XfManager) -> Option<CtCellXfs> {
    let xfs: Vec<_> = dense_by_id(manager.get_data_with_id_sorted_by_id())
        .into_iter()
        .map(|ctrl_xf| ctrl_xf.to_ct_xf())
        .collect();
    let count = xfs.len() as u32;
    if count > 0 {
        Some(CtCellXfs { count, xfs })
    } else {
        None
    }
}

fn save_borders(manager: &BorderManager) -> Option<CtBorders> {
    let borders = dense_by_id(manager.get_data_with_id_sorted_by_id());
    let count = borders.len() as u32;
    if count > 0 {
        Some(CtBorders { count, borders })
    } else {
        None
    }
}

fn save_fonts(manager: &FontManager) -> Option<CtFonts> {
    let fonts = dense_by_id(manager.get_data_with_id_sorted_by_id());
    let count = fonts.len() as u32;
    if count > 0 {
        Some(CtFonts { count, fonts })
    } else {
        None
    }
}

fn save_fills(manager: &FillManager) -> Option<CtFills> {
    let fills = dense_by_id(manager.get_data_with_id_sorted_by_id());
    let count = fills.len() as u32;
    if count > 0 {
        Some(CtFills { count, fills })
    } else {
        None
    }
}

fn save_num_fmts(manager: &NumFmtManager) -> Option<CtNumFmts> {
    let num_fmts: Vec<_> = manager
        .get_data_with_id_sorted_by_id()
        .into_iter()
        .map(|(id, v)| CtNumFmt {
            num_fmt_id: id,
            format_code: v,
        })
        .collect();
    let count = num_fmts.len() as u32;
    if count > 0 {
        Some(CtNumFmts { count, num_fmts })
    } else {
        None
    }
}
