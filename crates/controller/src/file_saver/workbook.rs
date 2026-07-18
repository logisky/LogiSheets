use itertools::Itertools;
use logisheets_base::NormalRange;
use logisheets_workbook::{
    logisheets::{AppData, LinkRangeXml, LogiSheetsData, Sheet},
    prelude::{
        CtExternalReference, CtExternalReferences, CtPerson, CtSheet, CtSheets, Persons,
        WorkbookPart,
    },
    workbook::{DocProps, Media, Wb, Worksheet, WorksheetDrawing, Xl},
};
use std::collections::HashMap;

use crate::{
    block_manager::{
        field_manager::{FieldRenderManager, persistence::field_renders_to_xml},
        schema_manager::{SchemaManager, persistence::schemas_to_xml},
    },
    cell_attachments::CellAttachmentsManager,
    container::DataContainer,
    data_validation_manager::DataValidationManager,
    ext_book_manager::ExtBooksManager,
    file_saver::{
        external_links::save_external_link, styles::save_sheet_style, worksheet::save_sheets,
    },
    formula_manager::FormulaManager,
    id_manager::{SheetIdManager, TextIdManager},
    image_manager::ImageManager,
    navigator::Navigator,
    settings::Settings,
    style_manager::StyleManager,
    theme_manager::ThemeManager,
    workbook::sheet_info_manager::SheetInfoManager,
};

use super::{SaverTrait, error::SaveError, sst::save_sst};

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
    navigator: &Navigator,
    settings: &Settings,
    app_data: Vec<AppData>,
    block_schema_manager: &SchemaManager,
    field_render_manager: &FieldRenderManager,
    image_manager: &ImageManager,
    data_validation_manager: &DataValidationManager,
    range_manager: &crate::range_manager::RangeManager,
    saver: &mut S,
) -> Result<Wb, SaveError> {
    let mut worksheets: HashMap<String, Worksheet> = HashMap::new();
    let mut ct_sheets: Vec<CtSheet> = vec![];
    let mut sheets: Vec<Sheet> = vec![];
    // Accumulated across all sheets: image bytes go to xl/media/ with globally
    // unique names; each sheet's drawing references them by relationship.
    let mut medias: Vec<Media> = vec![];
    let mut media_counter: usize = 0;

    sheet_id_manager
        .get_all_ids()
        .into_iter()
        .flat_map(|id| {
            let default_container = crate::container::SheetDataContainer::default();
            let sheet_data_container = data_container
                .get_sheet_container(id)
                .unwrap_or(&default_container);
            let sheet_nav = navigator
                .sheet_navs
                .get(&id)
                .ok_or(SaveError::SheetIdPosError(id))?;
            save_sheets(
                id,
                sheet_data_container,
                formula_manager,
                attachment_manager,
                sheet_pos_manager,
                sheet_id_manager,
                sheet_nav,
                settings,
                saver,
            )
        })
        .sorted_by_key(|a| a.0)
        .for_each(|(sheet_pos, ct_sheet, mut worksheet, block_ranges)| {
            // The tuple's first element is the sheet *position* (usize),
            // not the `SheetId`. Resolve the id from the position manager
            // so `schemas_to_xml` can filter by stable id.
            let sheet_id = sheet_pos_manager
                .get_sheet_id(sheet_pos)
                .expect("sheet position has a registered sheet id");

            // Attach cell images as a SpreadsheetDrawingML part. Each image's
            // stable CellId is resolved to a (row, col) position; images on
            // deleted cells (no position) are dropped.
            let mut cell_images: Vec<(i32, i32, String)> = vec![];
            for (cell_id, img) in image_manager.images_of_sheet(sheet_id) {
                if let Ok((row, col)) = navigator.fetch_cell_idx(&sheet_id, &cell_id) {
                    media_counter += 1;
                    let media_name = format!("image{}.{}", media_counter, img.format);
                    cell_images.push((col as i32, row as i32, media_name.clone()));
                    medias.push(Media {
                        name: media_name,
                        data: (*img.data).clone(),
                    });
                }
            }
            if !cell_images.is_empty() {
                worksheet.drawing = Some(WorksheetDrawing::from_cell_images(&cell_images));
            }

            // Round-trip Excel data validation, stored verbatim per sheet.
            worksheet.worksheet_part.data_validations =
                data_validation_manager.get_sheet(sheet_id).cloned();

            worksheets.insert(ct_sheet.id.clone(), worksheet);
            ct_sheets.push(ct_sheet);
            let (row_schemas, col_schemas, random_schemas) =
                schemas_to_xml(block_schema_manager, sheet_id);
            // Range links: source rectangle (facade) + target block id.
            let link_ranges: Vec<LinkRangeXml> = range_manager
                .get_sheet_manager_assert(&sheet_id)
                .map(|m| {
                    m.links
                        .iter()
                        .filter_map(|(source, target)| {
                            let (s0, s1) = match source {
                                NormalRange::Single(c) => (*c, *c),
                                NormalRange::AddrRange(a, b) => (*a, *b),
                                _ => return None,
                            };
                            let (start_row, start_col) =
                                navigator.fetch_normal_cell_idx(&sheet_id, &s0).ok()?;
                            let (end_row, end_col) =
                                navigator.fetch_normal_cell_idx(&sheet_id, &s1).ok()?;
                            Some(LinkRangeXml {
                                block_id: target.block_id(),
                                start_row,
                                start_col,
                                end_row,
                                end_col,
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            // field_renders_to_xml is invoked once at the end, below —
            // it's workbook-global, not per sheet.
            let sheet = Sheet {
                block_ranges,
                cell_appendices: vec![],
                row_schemas,
                col_schemas,
                random_schemas,
                link_ranges,
            };
            sheets.push(sheet);
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
    let persons = save_persons(attachment_manager);
    let workbook = Wb {
        xl: Xl {
            workbook_part: get_workbook(ct_sheets, ct_references),
            styles: (style_id, styles),
            sst,
            worksheets,
            external_links,
            theme,
            persons,
            medias,
        },
        doc_props: DocProps::default(),
        logisheets: Some(LogiSheetsData {
            sheets,
            apps: app_data,
            field_renders: field_renders_to_xml(field_render_manager, style_manager),
        }),
    };
    Ok(workbook)
}

/// Serialize the workbook-level person registry to `xl/persons/person.xml`.
/// Returns `None` when no persons exist (so no part / rel is emitted).
fn save_persons(attachment_manager: &CellAttachmentsManager) -> Option<Persons> {
    let persons = attachment_manager
        .comments
        .persons
        .iter()
        .map(|(_, p)| CtPerson {
            display_name: p.display_name.clone(),
            id: p.guid.clone(),
            user_id: p.user_id.clone(),
            provider_id: p.provider_id.clone(),
        })
        .collect::<Vec<_>>();
    if persons.is_empty() {
        None
    } else {
        Some(Persons { persons })
    }
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
