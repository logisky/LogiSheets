use itertools::Itertools;
use logisheets_workbook::{
    prelude::{CtExternalReference, CtExternalReferences, CtSheet, CtSheets, WorkbookPart},
    workbook::{DocProps, Wb, Worksheet, Xl},
};
use std::collections::HashMap;

use crate::{
    cell_attachments::CellAttachmentsManager,
    container::DataContainer,
    ext_book_manager::ExtBooksManager,
    file_saver::{
        external_links::save_external_link, styles::save_sheet_style, worksheet::save_sheets,
    },
    formula_manager::FormulaManager,
    id_manager::{SheetIdManager, TextIdManager},
    settings::Settings,
    style_manager::StyleManager,
    theme_manager::ThemeManager,
    workbook::sheet_info_manager::SheetInfoManager,
};

use super::{error::SaveError, sst::save_sst, SaverTrait};

pub fn save_workbook<S: SaverTrait>(
    data_container: &DataContainer,
    formula_manager: &FormulaManager,
    attachment_manager: &CellAttachmentsManager,
    sheet_pos_manager: &SheetInfoManager,
    sheet_id_manager: &SheetIdManager,
    style_manager: &StyleManager,
    ext_book_manager: &ExtBooksManager,
    theme_manager: &ThemeManager,
    text_id_manager: &TextIdManager,
    settings: &Settings,
    saver: &mut S,
) -> Result<Wb, SaveError> {
    let mut worksheets: HashMap<String, Worksheet> = HashMap::new();
    let mut ct_sheets: Vec<CtSheet> = vec![];

    sheet_id_manager
        .get_all_ids()
        .into_iter()
        .flat_map(|id| {
            let sheet_data_container = data_container
                .get_sheet_container(id)
                .ok_or(SaveError::SheetIdPosError(id))?;
            save_sheets(
                id,
                sheet_data_container,
                formula_manager,
                attachment_manager,
                sheet_pos_manager,
                sheet_id_manager,
                settings,
                saver,
            )
        })
        .sorted_by_key(|a| a.0)
        .for_each(|(_, ct_sheet, worksheet)| {
            worksheets.insert(ct_sheet.id.clone(), worksheet);
            ct_sheets.push(ct_sheet);
        });
    let ct_sheets = CtSheets { sheets: ct_sheets };
    let styles = save_sheet_style(style_manager, saver);
    let style_id = saver.fetch_part_id();
    let (external_links, ct_references) = {
        let mut result = HashMap::new();
        let links = save_external_link(ext_book_manager, saver);
        let mut ct_references = Vec::with_capacity(links.len());
        links.into_iter().for_each(|link| {
            let id = saver.fetch_part_id();
            ct_references.push(CtExternalReference { id: id.clone() });
            result.insert(id, link);
        });
        (result, ct_references)
    };
    let theme = {
        if theme_manager.theme.is_none() {
            None
        } else {
            let t = theme_manager.clone().theme.unwrap();
            Some((saver.fetch_part_id(), t))
        }
    };
    let sst_part = save_sst(text_id_manager);
    let sst = if let Some(part) = sst_part {
        let id = saver.fetch_part_id();
        Some((id, part))
    } else {
        None
    };
    let workbook = Wb {
        xl: Xl {
            workbook_part: get_workbook(ct_sheets, ct_references),
            styles: (style_id, styles),
            sst,
            worksheets,
            external_links,
            theme,
        },
        doc_props: DocProps::default(),
        logisheets: None,
    };
    Ok(workbook)
}

fn get_workbook(ct_sheets: CtSheets, ext_references: Vec<CtExternalReference>) -> WorkbookPart {
    let external_references = if ext_references.is_empty() {
        None
    } else {
        Some(CtExternalReferences {
            external_references: ext_references,
        })
    };
    WorkbookPart {
        file_version: None,
        file_sharing: None,
        workbook_pr: None,
        workbook_protection: None,
        book_views: None,
        sheets: ct_sheets,
        function_groups: None,
        external_references,
        defined_names: None,
        calc_pr: None,
        ole_size: None,
        custom_workbook_views: None,
        pivot_caches: None,
        smart_tag_pr: None,
        smart_tag_types: None,
        web_publishing: None,
        file_recovery_pr: None,
        web_publish_objects: None,
        conformance: None,
    }
}
