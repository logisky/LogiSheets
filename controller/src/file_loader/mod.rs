use std::collections::HashMap;

use xlrs_workbook::{reader::Spreadsheet, styles::StyleSheetPart};

use crate::{
    cell_attachments::CellAttachmentsManager,
    controller::{status::Status, Controller},
    external_links::ExternalLinksManager,
    file_loader::sheet::{load_sheet_tab, SheetLoader, SheetLoaderResult},
    id_manager::NameIdManager,
};

use self::{external_links::load_external_links, settings::SettingsLoader};

mod external_links;
mod id_fetcher;
mod settings;
mod sheet;
mod sst;
mod style;
mod utils;
mod vertex;

pub fn load(ss: Spreadsheet, book_name: String) -> Controller {
    let workbook = ss.workbook.workbook;
    let sst_part = ss.workbook.shared_strings;
    let style_sheet_part = ss.workbook.styles.unwrap_or(StyleSheetPart::default());
    let (mut sheet_id_manager, sheet_pos_manager) = load_sheet_tab(workbook.sheets);
    let mut name_id_manager = NameIdManager::new(0);
    let (external_links_manager, ext_book_recorder) =
        if let Some(links) = ss.workbook.external_links {
            let mut sheet_id_fetcher = |s: &str| sheet_id_manager.get_id(s).clone();
            let mut name_id_fetcher =
                |book_id, s: String| name_id_manager.get_id(&(book_id, s)).clone();
            load_external_links(links, &mut sheet_id_fetcher, &mut name_id_fetcher)
        } else {
            (ExternalLinksManager::new(), HashMap::new())
        };
    let mut settings_loader = SettingsLoader::new();
    let calc_pr = workbook.calc_pr;
    if let Some(pr) = calc_pr {
        settings_loader.load_calc_pr(pr);
    }
    let mut sheet_loader = SheetLoader::new(
        book_name,
        style_sheet_part,
        sheet_id_manager,
        sheet_pos_manager,
        name_id_manager,
        sst_part,
        ext_book_recorder,
        settings_loader,
    );
    let worksheets = ss.workbook.worksheets;
    worksheets
        .sheets
        .into_iter()
        .enumerate()
        .for_each(|(idx, ws)| {
            if let Some(comments) = ws.comment {
                sheet_loader.load_comments(idx, comments)
            }
            let s = ws.sheet;
            if let Some(pr) = s.sheet_format_pr {
                sheet_loader.load_sheet_format_pr(idx, pr);
            }
            sheet_loader.load_cols(idx, s.cols);
            sheet_loader.load_sheet_data(idx, s.sheet_data);
            if let Some(merge_cells) = s.merge_cells {
                sheet_loader.load_merge_cells(idx, merge_cells);
            }
        });
    let SheetLoaderResult {
        navigator,
        vertex_manager,
        container,
        sheet_id_manager,
        sheet_pos_manager,
        func_id_manager,
        text_id_manager,
        name_id_manager,
        style_manager,
        comments,
        merge_cells,
        book_name,
        settings_loader,
    } = sheet_loader.finish();
    let cell_attachment_manager = CellAttachmentsManager {
        comments,
        merge_cells,
    };
    let status = Status {
        navigator,
        vertex_manager,
        container,
        sheet_id_manager,
        func_id_manager,
        text_id_manager,
        name_id_manager,
        external_links_manager,
        sheet_pos_manager,
        style_manager,
        cell_attachment_manager,
    };
    Controller::from(status, book_name, settings_loader.finish())
}
