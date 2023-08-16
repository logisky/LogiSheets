use crate::style_manager::{
    border_manager::BorderManager, fill_manager::FillManager, font_manager::FontManager,
    num_fmt_manager::NumFmtManager, xf_manager::XfManager, StyleManager,
};
use logisheets_workbook::prelude::{
    CtBorders, CtCellStyleXfs, CtCellXfs, CtFills, CtFonts, CtNumFmt, CtNumFmts, StylesheetPart,
};

use super::SaverTrait;

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
        dxfs: None,
        table_styles: None,
        colors: None,
        ext_lst: None,
    }
}

fn save_cell_style_xfs(manager: &XfManager) -> Option<CtCellStyleXfs> {
    let xfs: Vec<_> = manager
        .get_data_sorted_by_id()
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
    let xfs: Vec<_> = manager
        .get_data_sorted_by_id()
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
    let borders = manager.get_data_sorted_by_id();
    let count = borders.len() as u32;
    if count > 0 {
        Some(CtBorders { count, borders })
    } else {
        None
    }
}

fn save_fonts(manager: &FontManager) -> Option<CtFonts> {
    let fonts = manager.get_data_sorted_by_id();
    let count = fonts.len() as u32;
    if count > 0 {
        Some(CtFonts { count, fonts })
    } else {
        None
    }
}

fn save_fills(manager: &FillManager) -> Option<CtFills> {
    let fills = manager.get_data_sorted_by_id();
    let count = fills.len() as u32;
    if count > 0 {
        Some(CtFills { count, fills })
    } else {
        None
    }
}

fn save_num_fmts(manager: &NumFmtManager) -> Option<CtNumFmts> {
    let num_fmts: Vec<_> = manager
        .get_data_sorted_by_id()
        .into_iter()
        .enumerate()
        .map(|(id, v)| CtNumFmt {
            num_fmt_id: id as u32, // todo
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
