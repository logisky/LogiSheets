pub mod async_func;
pub mod block_affect;
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
use gents_derives::TS;
use logisheets_workbook::prelude::*;
use serde::Serialize;
use std::hash::Hash;

pub type Id = u32;
pub type RowId = u32;
pub type ColId = u32;
pub type RangeId = u32;
pub type CubeId = u32;
pub type ExtRefId = u32;
pub type SheetId = u16;
pub type TextId = u32;
pub type NameId = u8;
pub type FuncId = u16;
pub type BlockId = u16;
pub const CURR_BOOK: ExtBookId = 0;
pub type ExtBookId = u8;
pub type AuthorId = u8;
pub type StyleId = u32;

#[derive(Clone, Hash, Debug, Eq, PartialEq, Copy, Serialize, TS)]
#[ts(file_name = "cell_id.ts")]
pub enum CellId {
    NormalCell(NormalCellId),
    BlockCell(BlockCellId),
}

#[derive(Clone, Hash, Debug, Eq, PartialEq, Copy, Serialize, TS)]
#[ts(file_name = "normal_cell_id.ts", rename_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub struct NormalCellId {
    pub row: RowId,
    pub col: ColId,
    pub follow_row: Option<RowId>,
    pub follow_col: Option<ColId>,
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub struct RefAbs {
    pub start_row: bool,
    pub start_col: bool,
    pub end_row: bool,
    pub end_col: bool,
}

impl RefAbs {
    pub fn from_col_range(start: bool, end: bool) -> Self {
        RefAbs {
            start_row: false,
            start_col: start,
            end_row: false,
            end_col: end,
        }
    }

    pub fn from_row_range(start: bool, end: bool) -> Self {
        RefAbs {
            start_row: start,
            start_col: false,
            end_row: end,
            end_col: false,
        }
    }

    pub fn from_addr(row: bool, col: bool) -> Self {
        RefAbs {
            start_row: row,
            start_col: col,
            end_row: false,
            end_col: false,
        }
    }

    pub fn from_addr_range(start_row: bool, end_row: bool, start_col: bool, end_col: bool) -> Self {
        RefAbs {
            start_row,
            start_col,
            end_row,
            end_col,
        }
    }
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum NormalRange {
    Single(NormalCellId),
    RowRange(RowId, RowId),
    ColRange(ColId, ColId),
    AddrRange(NormalCellId, NormalCellId),
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum BlockRange {
    Single(BlockCellId),
    AddrRange(BlockCellId, BlockCellId),
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum Range {
    Normal(NormalRange),
    Block(BlockRange),
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub struct Cube {
    pub from_sheet: SheetId,
    pub to_sheet: SheetId,
    pub cross: CubeCross,
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum CubeCross {
    // (row_idx, col_idx) pair
    Single(usize, usize),
    // (start_row_idx, end_row_idx)
    RowRange(usize, usize),
    // (start_col_idx, end_col_idx)
    ColRange(usize, usize),
    AddrRange(Addr, Addr),
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub struct ExtRef {
    pub ext_book: ExtBookId,
    pub from_sheet: Option<SheetId>,
    pub to_sheet: SheetId,
    pub cross: CubeCross,
}

#[derive(Clone, Hash, Debug, Eq, PartialEq, Copy, Serialize, TS)]
#[ts(file_name = "block_cell_id.ts", rename_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub struct BlockCellId {
    pub block_id: BlockId,
    // block inner row id
    pub row: RowId,
    // block inner col id
    pub col: ColId,
}

#[derive(Debug, Clone, Default, Hash, PartialEq, Eq, Copy)]
pub struct Addr {
    pub row: usize,
    pub col: usize,
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
    InlineStr(CtRst),
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

    pub fn to_ct_value(self) -> (Option<PlainTextString>, StCellType) {
        match self {
            CellValue::Blank => (None, StCellType::N),
            CellValue::Boolean(b) => (
                Some(PlainTextString {
                    value: if b {
                        String::from("1")
                    } else {
                        String::from("0")
                    },
                    space: None,
                }),
                StCellType::B,
            ),
            CellValue::Date(_) => todo!(),
            CellValue::Error(e) => (
                Some(PlainTextString {
                    value: e.to_string(),
                    space: None,
                }),
                StCellType::E,
            ),
            CellValue::String(id) => {
                let plain_text_string = PlainTextString {
                    value: id.to_string(),
                    space: None,
                };
                (Some(plain_text_string), StCellType::S)
            }
            CellValue::Number(num) => (
                Some(PlainTextString {
                    value: num.to_string(),
                    space: None,
                }),
                StCellType::N,
            ),
            CellValue::InlineStr(_) => todo!(),
            CellValue::FormulaStr(_) => todo!(),
        }
    }

    fn get_value<F>(
        t: &StCellType,
        value: Option<&PlainTextString>,
        is: Option<&CtRst>,
        mut f: F,
    ) -> CellValue
    where
        F: FnMut(usize) -> TextId,
    {
        if let Some(text) = value {
            match t {
                StCellType::N => {
                    let num = text.value.parse::<f64>().unwrap();
                    CellValue::Number(num)
                }
                StCellType::B => {
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
                StCellType::S => {
                    let idx = text.value.parse::<usize>().unwrap();
                    let id = f(idx);
                    CellValue::String(id)
                }
                StCellType::InlineStr => {
                    if let Some(is) = is {
                        CellValue::InlineStr(is.clone())
                    } else {
                        CellValue::Blank
                    }
                }
                StCellType::Str => CellValue::FormulaStr(text.value.clone()),
                StCellType::D => {
                    let dt = DateTime::parse_from_rfc3339(&text.value);
                    match dt {
                        Ok(d) => CellValue::Date(d),
                        Err(_) => CellValue::Blank,
                    }
                }
                StCellType::E => {
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

    pub fn from_cell<F>(c: &CtCell, f: F) -> CellValue
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

#[cfg(test)]
mod tests {
    use super::{column_label_to_index, index_to_column_label};
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
}
