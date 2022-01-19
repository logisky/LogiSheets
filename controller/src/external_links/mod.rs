use im::HashMap;
use itertools::Itertools;
use parser::ast;
use xlrs_workbook::{external_link::ExternalCell, simple_types::StCellType};

use controller_base::{
    cube_value::CubeValue, id_fetcher::IdFetcherTrait, matrix_value::MatrixValue, Addr, ExtBookId,
    NameId, SheetId,
};

use crate::{
    addr_parser,
    calc_engine::calculator::calc_vertex::{CalcValue, Value},
    id_manager::BookIdManager,
};

// Mainly external book.
#[derive(Debug, Clone)]
pub struct ExternalLinksManager {
    pub book_id_manager: BookIdManager,
    pub books: HashMap<ExtBookId, ExtBook>,
}

impl ExternalLinksManager {
    pub fn new() -> Self {
        ExternalLinksManager {
            book_id_manager: BookIdManager::new(0),
            books: HashMap::new(),
        }
    }
    pub fn fetch_book_name(&self, id: &ExtBookId) -> Option<String> {
        self.book_id_manager.get_string(id)
    }

    pub fn fetch_ext_book_id(&mut self, name: &str) -> ExtBookId {
        self.book_id_manager.get_id(name)
    }

    pub fn get_addr_range_value(
        &self,
        book_id: ExtBookId,
        from_sheet_id: Option<SheetId>,
        sheet_id: SheetId,
        start: Addr,
        end: Addr,
    ) -> CalcValue {
        todo!()
    }

    pub fn get_addr_value(&self, book_id: ExtBookId, sheet_id: SheetId, addr: Addr) -> CalcValue {
        todo!()
    }

    pub fn get_row_range_value(
        &self,
        book_id: ExtBookId,
        from_sheet_id: Option<SheetId>,
        sheet_id: SheetId,
        start: usize,
        end: usize,
    ) -> CalcValue {
        todo!()
    }

    pub fn get_col_range_value(
        &self,
        book_id: ExtBookId,
        from_sheet_id: Option<SheetId>,
        sheet_id: SheetId,
        start: usize,
        end: usize,
    ) -> CalcValue {
        todo!()
    }
}

#[derive(Debug, Clone)]
pub struct ExtBook {
    pub book_id: ExtBookId,
    pub book_name: String,
    pub sheets: Vec<SheetId>,
    pub defined_names: Vec<(NameId, String)>,
    pub data_set: std::collections::HashMap<(SheetId, Addr), Value>,
}

impl ExtBook {
    pub fn get_ext_value(
        &self,
        from_sheet: Option<SheetId>,
        to_sheet: SheetId,
        start: Addr,
        end: Addr,
    ) -> CalcValue {
        let to = self.sheets.iter().find_position(|s| to_sheet == **s);
        if to.is_none() {
            return CalcValue::Scalar(Value::Error(ast::Error::Name));
        }
        let to_index = to.unwrap().0;
        let from_index = from_sheet.map_or(to_index, |sheet_id| {
            self.sheets
                .iter()
                .find_position(|s| **s == sheet_id)
                .unwrap()
                .0
                .clone()
        });
        let mut result_vec = Vec::<MatrixValue<Value>>::new();
        (from_index..to_index + 1).into_iter().for_each(|idx| {
            let v = self.get_value_from_one_sheet(idx, start.clone(), end.clone());
            result_vec.push(v)
        });
        if result_vec.len() > 1 {
            let cube = CubeValue::new(result_vec);
            CalcValue::Cube(cube)
        } else if result_vec.len() == 1 {
            let range = result_vec.into_iter().next().unwrap();
            CalcValue::Range(range)
        } else {
            CalcValue::Scalar(Value::Error(ast::Error::Name))
        }
    }

    fn get_value_from_one_sheet(
        &self,
        sheet_idx: usize,
        start: Addr,
        end: Addr,
    ) -> MatrixValue<Value> {
        let sheet = self.sheets.get(sheet_idx).unwrap().clone();
        let func = |r: usize, c: usize| {
            let value = self.data_set.get(&(sheet, Addr { row: r, col: c }));
            match value {
                Some(v) => v.clone(),
                None => Value::Blank,
            }
        };
        let vec2d = cross_map(start, end, &func);
        MatrixValue::from(vec2d)
    }
}

fn convert_external_cell<F>(e: ExternalCell, fetcher: &mut F) -> Option<(Addr, Value)>
where
    F: IdFetcherTrait,
{
    let addr_string = e.r?;
    let addr = addr_parser::parse_addr(&addr_string)?;
    let v = e.v.value;
    match e.t {
        StCellType::Type::B => {
            let b = if v == "TRUE" { true } else { false };
            Some((addr, Value::Boolean(b)))
        }
        StCellType::Type::D => todo!(),
        StCellType::Type::E => todo!(),
        StCellType::Type::N => todo!(),
        StCellType::Type::S => todo!(),
        StCellType::Type::Str => todo!(),
        StCellType::Type::InlineStr => todo!(),
    }
}

fn cross_map<T, F>(start: Addr, end: Addr, func: &F) -> Vec<Vec<T>>
where
    F: Fn(usize, usize) -> T,
{
    (start.row..end.row + 1)
        .into_iter()
        .fold(Vec::new(), |mut prev, r| {
            let v = (start.col..end.col + 1)
                .into_iter()
                .fold(Vec::new(), |mut p, c| {
                    p.push(func(r, c));
                    p
                });
            prev.push(v);
            prev
        })
}
