use crate::calc_engine::calculator::calc_vertex::{CalcValue, Value};
use crate::id_manager::BookIdManager;
use imbl::{HashMap, Vector};
use logisheets_base::{Addr, ExtBookId, SheetId};
use logisheets_parser::ast;

#[derive(Debug, Clone)]
pub struct ExtBooksManager {
    pub book_id_manager: BookIdManager,
    pub books: HashMap<ExtBookId, ExtBook>,
    pub orders: Vector<ExtBookId>,
}

impl ExtBooksManager {
    pub fn new() -> Self {
        ExtBooksManager {
            book_id_manager: BookIdManager::new(0),
            books: HashMap::new(),
            orders: Vector::new(),
        }
    }

    pub fn fetch_book_name(&self, id: &ExtBookId) -> Option<String> {
        self.book_id_manager.get_string(id)
    }

    pub fn fetch_ext_book_id(&mut self, name: &str) -> ExtBookId {
        self.book_id_manager.get_or_register_id(name)
    }

    fn check(&mut self, book_id: ExtBookId, sheet_id: SheetId) {
        if !self.books.contains_key(&book_id) {
            let b = ExtBook::new_with_sheet_id(sheet_id);
            self.orders.push_back(book_id);
            self.books.insert(book_id, b);
            return;
        }
        let book = self.books.get_mut(&book_id).unwrap();
        if book.sheets.iter().find(|s| **s == sheet_id).is_none() {
            book.sheets.push_back(sheet_id);
        }
    }

    pub fn get_addr_range_value(
        &mut self,
        book_id: ExtBookId,
        from_sheet_id: Option<SheetId>,
        sheet_id: SheetId,
        _start: Addr,
        _end: Addr,
    ) -> CalcValue {
        self.check(book_id, sheet_id);
        if let Some(f) = from_sheet_id {
            self.check(book_id, f);
        }
        CalcValue::Scalar(Value::Error(ast::Error::Ref))
    }

    pub fn get_addr_value(
        &mut self,
        book_id: ExtBookId,
        sheet_id: SheetId,
        _addr: Addr,
    ) -> CalcValue {
        self.check(book_id, sheet_id);
        CalcValue::Scalar(Value::Error(ast::Error::Ref))
    }

    pub fn get_row_range_value(
        &mut self,
        book_id: ExtBookId,
        from_sheet_id: Option<SheetId>,
        sheet_id: SheetId,
        _start: usize,
        _end: usize,
    ) -> CalcValue {
        self.check(book_id, sheet_id);
        if let Some(f) = from_sheet_id {
            self.check(book_id, f);
        }
        CalcValue::Scalar(Value::Error(ast::Error::Ref))
    }

    pub fn get_col_range_value(
        &mut self,
        book_id: ExtBookId,
        from_sheet_id: Option<SheetId>,
        sheet_id: SheetId,
        _start: usize,
        _end: usize,
    ) -> CalcValue {
        self.check(book_id, sheet_id);
        if let Some(f) = from_sheet_id {
            self.check(book_id, f);
        }
        CalcValue::Scalar(Value::Error(ast::Error::Ref))
    }
}

#[derive(Debug, Clone)]
pub struct ExtBook {
    pub sheets: Vector<SheetId>,
    // TODO: external name.
    // pub names: Vector<(NameId, String)>,
    pub data_set: HashMap<(SheetId, Addr), Value>,
}

impl ExtBook {
    pub fn new_with_sheet_id(sheet_id: SheetId) -> Self {
        let mut sheets = Vector::new();
        sheets.push_back(sheet_id);
        ExtBook {
            sheets,
            data_set: HashMap::new(),
        }
    }
}
