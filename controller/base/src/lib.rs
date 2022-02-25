extern crate chrono;
extern crate futures;
extern crate im;
extern crate serde;
extern crate xlrs_workbook;
pub mod async_func;
pub mod block_affect;
pub mod block_affected;
pub mod cube_value;
pub mod datetime;
pub mod get_active_sheet;
pub mod get_book_name;
pub mod get_curr_addr;
pub mod get_norm_cell_id;
pub mod get_norm_cells_in_line;
pub mod id_fetcher;
pub mod index_fetcher;
pub mod matrix_value;
pub mod name_fetcher;
pub mod set_curr_cell;

use chrono::{DateTime, FixedOffset};
use std::hash::Hash;
use xlrs_workbook::complex_types::Rst;
use xlrs_workbook::simple_types::StCellType;
use xlrs_workbook::worksheet::Cell;
use xlrs_workbook::{complex_types::*, external_link::ExternalCell};

pub type Id = u32;
pub type RowId = u32;
pub type ColId = u32;
pub type SheetId = u16;
pub type TextId = u32;
pub type NameId = u8;
pub type FuncId = u8;
pub type BlockId = u16;
pub const CURR_BOOK: ExtBookId = 0;
pub type ExtBookId = u8;
pub type AuthorId = u8;
pub type StyleId = u32;

pub trait Payload {}

#[derive(Debug)]
pub enum VisitResultType<'c, C> {
    Build(&'c C),
    Unbuild,
}

#[derive(Clone, Hash, Debug, Eq, PartialEq, Copy)]
pub enum CellId {
    NormalCell(NormalCellId),
    BlockCell(BlockCellId),
}

#[derive(Clone, Hash, Debug, Eq, PartialEq, Copy)]
pub struct NormalCellId {
    pub row: RowId,
    pub col: ColId,
    pub follow_row: Option<RowId>,
    pub follow_col: Option<ColId>,
}

#[derive(Clone, Hash, Debug, Eq, PartialEq, Copy)]
pub struct BlockCellId {
    pub block_id: BlockId,
    // block inner row id
    pub row: RowId,
    // block inner col id
    pub col: ColId,
}

pub struct Reference {
    pub sheet_id: SheetId,
    pub position: Position,
}

pub enum Position {
    Addr(Addr),
    Span(Span),
}

#[derive(Debug, Clone, Default, Hash, PartialEq, Eq, Copy)]
pub struct Addr {
    pub row: usize,
    pub col: usize,
}

#[derive(Debug, Clone)]
pub struct Span {
    pub start: Addr,
    pub end: Addr,
}

#[derive(Debug, Clone)]
pub enum Error {
    Unspecified,
    Div0,        // #DIV/0!
    NA,          // #N/A
    Name,        // #NAME?
    Null,        // #NULL!
    Num,         // #NUM!
    Ref,         // #REF!
    Value,       // #VALUE!
    GettingData, // #GETTING_DATA
}

impl Error {
    pub fn to_string(&self) -> String {
        let s = match &self {
            Error::Div0 => "#DIV/0!",
            Error::NA => "#N/A",
            Error::Name => "#NAME?",
            Error::Null => "#NULL!",
            Error::Num => "#NUM!",
            Error::Ref => "#REF!",
            Error::Value => "#VALUE!",
            Error::GettingData => "#GETTING_DATA",
            Error::Unspecified => "#UNKNOWN!",
        };
        String::from(s)
    }
}

#[derive(Debug, Clone)]
pub enum CellValue {
    Blank,
    Boolean(bool),
    Date(DateTime<FixedOffset>),
    Error(Error),
    String(TextId),
    Number(f64),
    InlineStr(Rst),
    FormulaStr(String),
}

impl Default for CellValue {
    fn default() -> Self {
        CellValue::Blank
    }
}

impl CellValue {
    pub fn from_string<F>(text: String, text_id_fetcher: &mut F) -> Self
    where
        F: FnMut(&str) -> TextId,
    {
        let upper_text = text.to_uppercase();
        let text = text.trim();
        if text == "" {
            CellValue::Blank
        } else if upper_text == "TRUE" {
            CellValue::Boolean(true)
        } else if upper_text == "FALSE" {
            CellValue::Boolean(false)
        } else if text.starts_with('\'') {
            let mut chars = text.chars();
            chars.next();
            let text_id = text_id_fetcher(chars.as_str());
            CellValue::String(text_id)
        } else if let Ok(n) = text.parse::<f64>() {
            CellValue::Number(n)
        } else {
            let tid = text_id_fetcher(&text);
            CellValue::String(tid)
        }
    }

    fn get_value<F>(
        t: &StCellType::Type,
        value: Option<&PlainText>,
        is: Option<&Rst>,
        mut f: F,
    ) -> CellValue
    where
        F: FnMut(usize) -> TextId,
    {
        if let Some(text) = value {
            match t {
                StCellType::Type::N => {
                    let num = text.value.parse::<f64>().unwrap();
                    CellValue::Number(num)
                }
                StCellType::Type::B => {
                    if text.value == "1" {
                        CellValue::Boolean(true)
                    } else if text.value == "0" {
                        CellValue::Boolean(false)
                    } else {
                        let res = text.value.to_lowercase().parse::<bool>();
                        let v = match res {
                            Ok(b) => b,
                            Err(_) => false,
                        };
                        CellValue::Boolean(v)
                    }
                }
                StCellType::Type::S => {
                    let idx = text.value.parse::<usize>().unwrap();
                    let id = f(idx);
                    CellValue::String(id)
                }
                StCellType::Type::InlineStr => {
                    if let Some(is) = is {
                        CellValue::InlineStr(is.clone())
                    } else {
                        CellValue::Blank
                    }
                }
                StCellType::Type::Str => CellValue::FormulaStr(text.value.clone()),
                StCellType::Type::D => {
                    let dt = DateTime::parse_from_rfc3339(&text.value);
                    match dt {
                        Ok(d) => CellValue::Date(d),
                        Err(_) => CellValue::Blank,
                    }
                }
                StCellType::Type::E => {
                    let e = {
                        if &text.value == "#DIV/0!" {
                            Error::Div0
                        } else if &text.value == "#N/A" {
                            Error::NA
                        } else if &text.value == "#NAME?" {
                            Error::Name
                        } else if &text.value == "#NULL!" {
                            Error::Null
                        } else if &text.value == "#NUM!" {
                            Error::Num
                        } else if &text.value == "#VALUE!" {
                            Error::Value
                        } else if &text.value == "#GETTING_DATA" {
                            Error::GettingData
                        } else {
                            Error::Value
                        }
                    };
                    CellValue::Error(e)
                }
            }
        } else {
            CellValue::Blank
        }
    }

    pub fn from_external_cell<F>(c: &ExternalCell, f: F) -> CellValue
    where
        F: FnMut(usize) -> TextId,
    {
        CellValue::get_value(&c.t, Some(&c.v), None, f)
    }

    pub fn from_cell<F>(c: &Cell, f: F) -> CellValue
    where
        F: FnMut(usize) -> TextId,
    {
        CellValue::get_value(&c.t, c.v.as_ref(), c.is.as_ref(), f)
    }
}

pub fn column_label_to_index(label: &str) -> usize {
    let mut result: usize = 0;
    for (i, c) in label.chars().rev().enumerate() {
        result += (c as usize - 64) * 26_usize.pow(i as u32);
    }
    result - 1
}

pub fn index_to_column_label(index: usize) -> String {
    let mut result: Vec<char> = vec![];
    let mut left = index as i32;
    while left >= 0_i32 {
        let ch = (left % 26_i32 + 97_i32) as u8;
        result.insert(0, ch.to_ascii_uppercase() as char);
        left = ((left / 26_i32) as i32) - 1_i32;
    }
    result.iter().collect()
}

#[test]
fn label_to_index() {
    let label = String::from("AA");
    let result = column_label_to_index(&label);
    assert_eq!(result, 26);
    let label = String::from("A");
    let result = column_label_to_index(&label);
    assert_eq!(result, 0);
}

#[test]
fn index_to_label() {
    let idx = 26;
    let result = index_to_column_label(idx);
    assert_eq!(result, String::from("AA"));
    let idx = 29;
    let result = index_to_column_label(idx);
    assert_eq!(result, String::from("AD"));
    let idx = 0;
    let result = index_to_column_label(idx);
    assert_eq!(result, String::from("A"));
}
