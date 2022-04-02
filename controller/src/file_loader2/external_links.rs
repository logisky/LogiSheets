use super::utils::parse_cell;
use crate::calc_engine::calculator::calc_vertex::Value;
use crate::ext_book_manager::{ExtBook, ExtBooksManager};
use controller_base::{id_fetcher::SheetIdFetcherTrait, Addr, ExtBookId, SheetId};
use im::{HashMap, Vector};
use logisheets_workbook::workbook::ExternalLink;
use parser::ast;

pub fn load_external_link<T>(
    manager: &mut ExtBooksManager,
    ext: &ExternalLink,
    fetcher: &mut T,
) -> ExtBookId
where
    T: SheetIdFetcherTrait,
{
    if let Some(id) = manager.book_id_manager.has(&ext.target) {
        return id;
    }
    let ext_book = ext.external_link_part.external_book.as_ref().unwrap();
    let sheets = if let Some(ext_sheet_names) = &ext_book.sheet_names {
        let names = ext_sheet_names
            .names
            .iter()
            .map(|v| fetcher.fetch_sheet_id(&v.val))
            .collect::<Vec<_>>();
        names.into()
    } else {
        Vector::<SheetId>::new()
    };
    let mut data_set = HashMap::<(SheetId, Addr), Value>::new();
    if let Some(ds) = &ext_book.sheet_data_set {
        ds.data.iter().enumerate().for_each(|(idx, sheet_data)| {
            let sheet_id = sheets.get(idx).unwrap().clone();
            sheet_data.rows.iter().for_each(|r| {
                r.cells.iter().for_each(|ext_cell| {
                    if ext_cell.v.is_none() || ext_cell.r.is_none() {
                    } else {
                        let val_str = &ext_cell.v.as_ref().unwrap().value;
                        let cell_ref = ext_cell.r.as_ref().unwrap();
                        if let Some((r, c)) = parse_cell(cell_ref) {
                            use logisheets_workbook::prelude::simple_types::StCellType;
                            let val = match &ext_cell.t {
                                StCellType::B => {
                                    let b = if val_str == "TRUE" || val_str == "0" {
                                        true
                                    } else {
                                        false
                                    };
                                    Value::Boolean(b)
                                }
                                StCellType::D => Value::Error(ast::Error::Unspecified), // TODO
                                StCellType::N => {
                                    let num = val_str.parse::<f64>();
                                    match num {
                                        Ok(n) => Value::Number(n),
                                        Err(_) => Value::Error(ast::Error::Unspecified),
                                    }
                                }
                                StCellType::E => Value::Error(ast::Error::from_err_str(&val_str)),
                                StCellType::S => unreachable!(),
                                StCellType::Str => Value::Text(val_str.clone()),
                                StCellType::InlineStr => unreachable!(),
                            };
                            data_set.insert((sheet_id, Addr { row: r, col: c }), val);
                        }
                    }
                })
            })
        })
    }
    let b = ExtBook { sheets, data_set };
    let bid = manager.book_id_manager.get_id(&ext.target);
    manager.books.insert(bid, b);
    manager.orders.push_back(bid);
    bid
}
