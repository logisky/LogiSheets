use std::{cmp::max, collections::HashMap};

use controller_base::{Addr, ExtBookId, NameId, SheetId};
use parser::ast;
use xlrs_workbook::{
    external_link::{ExternalBook, ExternalSheetData},
    reader::ExternalLinks,
    relationships::RelationshipsPart,
    simple_types::StCellType,
};

use crate::{
    calc_engine::calculator::calc_vertex::Value,
    ext_book_manager::{ExtBook, ExtBooksManager},
    file_loader::utils::parse_cell,
    id_manager::BookIdManager,
};

pub fn load_external_links<S, N>(
    links: ExternalLinks,
    sheet_id_fetcher: &mut S,
    name_id_fetcher: &mut N,
) -> (ExtBooksManager, HashMap<usize, ExtBookId>)
where
    S: FnMut(&str) -> SheetId,
    N: FnMut(ExtBookId, String) -> NameId,
{
    let mut ext_books = im::HashMap::<ExtBookId, ExtBook>::new();
    let mut book_id_manager = BookIdManager::new(0);
    let mut m = HashMap::<usize, ExtBookId>::new();
    links
        .external_links
        .into_iter()
        .enumerate()
        .for_each(|(idx, el)| {
            let link = el.external_link;
            match link.external_book {
                Some(eb) => {
                    let rels = el.rels;
                    let book_name = get_ext_book_name(rels).unwrap_or(String::from("ExtBook"));
                    let book_id = book_id_manager.get_id(&book_name);
                    let ext_book =
                        convert_ext_book(book_id, eb, book_name, sheet_id_fetcher, name_id_fetcher);
                    ext_books.insert(book_id, ext_book);
                    m.insert(idx + 1, book_id);
                }
                None => {}
            }
        });
    // let manager = ExtBooksManager {
    //     book_id_manager,
    //     books: ext_books,
    // };
    // (manager, m)
    todo!()
}

fn get_ext_book_name(rels: RelationshipsPart) -> Option<String> {
    let target = rels.relationship.into_iter().next()?.target;
    let book_name = target.split('/').last()?.to_owned();
    Some(book_name)
}

fn convert_ext_book<S, N>(
    book_id: ExtBookId,
    eb: ExternalBook,
    name: String,
    sheet_id_fetcher: &mut S,
    name_id_fetcher: &mut N,
) -> ExtBook
where
    S: FnMut(&str) -> SheetId,
    N: FnMut(ExtBookId, String) -> NameId,
{
    let sheets = eb.sheet_names.map_or(Vec::new(), |sheet_names| {
        sheet_names
            .sheet_name
            .into_iter()
            .fold(Vec::new(), |mut prev, s| {
                let id = sheet_id_fetcher(&s.val);
                prev.push(id);
                prev
            })
    });
    let defined_names = eb.defined_names.map_or(Vec::new(), |dns| {
        dns.defined_name
            .into_iter()
            .fold(Vec::new(), |mut prev, n| {
                let name_id = name_id_fetcher(book_id, n.name);
                let refers_to = n.refers_to;
                prev.push((name_id, refers_to));
                prev
            })
    });
    let mut data_set = HashMap::<(SheetId, Addr), Value>::new();
    if let Some(ds) = eb.sheet_data_set {
        ds.sheet_data.into_iter().for_each(|d| {
            let idx = max(d.sheet_id, 1);
            let sheet_id = sheets.get(idx - 1).unwrap().clone();
            convert_data_set(d, sheet_id, &mut data_set);
        });
    }
    // ExtBook {
    //     book_id,
    //     book_name: name,
    //     sheets,
    //     defined_names,
    //     data_set,
    // }
    todo!()
}

fn convert_data_set(
    data: ExternalSheetData,
    sheet_id: SheetId,
    result: &mut HashMap<(SheetId, Addr), Value>,
) {
    data.row.into_iter().for_each(|r| {
        r.cell.into_iter().for_each(|c| {
            if c.r.is_none() {
                return;
            }
            let ref_str = c.r.unwrap();
            let pos = parse_cell(&ref_str);
            if pos.is_none() {
                return;
            }
            let (row, col) = pos.unwrap();
            let addr = Addr { row, col };
            let v_str = c.v.value;
            let value = match c.t {
                StCellType::Type::B => {
                    let b = if v_str == "TRUE" { true } else { false };
                    Value::Boolean(b)
                }
                StCellType::Type::D => {
                    let num = v_str.parse::<f64>();
                    match num {
                        Ok(n) => Value::Number(n),
                        Err(_) => Value::Error(ast::Error::Unspecified),
                    }
                }
                StCellType::Type::E => Value::Error(ast::Error::from_err_str(&v_str)),
                StCellType::Type::N => {
                    let num = v_str.parse::<f64>();
                    match num {
                        Ok(n) => Value::Number(n),
                        Err(_) => Value::Error(ast::Error::Unspecified),
                    }
                }
                StCellType::Type::S => todo!(),
                StCellType::Type::Str => Value::Text(v_str),
                StCellType::Type::InlineStr => unreachable!(),
            };
            result.insert((sheet_id, addr), value);
        })
    });
}
