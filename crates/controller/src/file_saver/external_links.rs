use std::collections::{hash_map::Entry, HashMap};

use logisheets_workbook::{
    prelude::{
        CtExternalBook, CtExternalCell, CtExternalRow, CtExternalSheetData, CtExternalSheetDataSet,
        CtExternalSheetName, CtExternalSheetNames, ExternalLinkPart, PlainTextString, StCellType,
    },
    workbook::ExternalLink,
};

use crate::{
    calc_engine::calculator::calc_vertex::Value, ext_book_manager::ExtBooksManager,
    file_saver::utils::unparse_cell,
};

use super::SaverTrait;

pub fn save_external_link<S: SaverTrait>(
    manager: &ExtBooksManager,
    saver: &mut S,
) -> Vec<ExternalLink> {
    let books = manager.orders.iter().map(|book_id| {
        let mut sheet_data: HashMap<u32, Vec<CtExternalRow>> = HashMap::new();
        let mut names: Vec<CtExternalSheetName> = vec![];

        let book = manager.books.get(book_id).unwrap();
        book.data_set.iter().for_each(|((sheet_id, addr), value)| {
            let mut row_data: HashMap<usize, Vec<CtExternalCell>> = HashMap::new();
            let r = unparse_cell(addr.row, addr.col);
            let (t, v) = match value {
                Value::Blank => unreachable!(),
                Value::Number(n) => (StCellType::N, n.to_string()),
                Value::Text(t) => (StCellType::Str, t.clone()),
                Value::Boolean(b) => (
                    StCellType::B,
                    if *b {
                        "TRUE".to_string()
                    } else {
                        "FALSE".to_string()
                    },
                ),
                Value::Error(e) => (StCellType::E, e.get_err_str().to_string()),
            };
            let ext_cell = CtExternalCell {
                v: Some(PlainTextString {
                    value: v,
                    space: None,
                }),
                r: Some(r),
                t,
                vm: 0,
            };
            match row_data.entry(addr.row) {
                Entry::Occupied(mut e) => e.get_mut().push(ext_cell),
                Entry::Vacant(e) => {
                    e.insert(vec![ext_cell]);
                }
            };
            let rows: Vec<CtExternalRow> = row_data
                .into_iter()
                .map(|(k, v)| CtExternalRow {
                    cells: v,
                    r: k as u32,
                })
                .collect();
            sheet_data.insert(sheet_id.clone() as u32, rows);
            names.push(CtExternalSheetName {
                val: saver.fetch_sheet_name(sheet_id).unwrap(),
            });
        });

        let data: Vec<CtExternalSheetData> = sheet_data
            .into_iter()
            .map(|(k, v)| CtExternalSheetData {
                rows: v,
                sheet_id: k,
                refresh_error: false,
            })
            .collect();
        let sheet_data_set = CtExternalSheetDataSet { data };
        let id = saver.fetch_part_id();
        let sheet_names = CtExternalSheetNames { names };
        let ext_book = CtExternalBook {
            sheet_names: Some(sheet_names),
            defined_names: None, // todo
            sheet_data_set: Some(sheet_data_set),
            id,
        };
        let link_part = ExternalLinkPart {
            external_book: Some(ext_book),
        };
        let target = manager.book_id_manager.get_string(book_id).unwrap();
        // let target = saver.fetch_external_link_target();
        ExternalLink {
            external_link_part: link_part,
            target,
        }
    });
    books.collect()
}
