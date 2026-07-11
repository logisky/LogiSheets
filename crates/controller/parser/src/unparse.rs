use logisheets_base::{
    BlockCellId, BlockRange, CellId, CubeCross, NormalCellId, NormalRange, Range, RefAbs, SheetId,
    index_to_column_label, name_fetcher::NameFetcherTrait,
};

use crate::ast::{
    BlockRefNode, CellReference, CubeDisplay, Error, ExtRefDisplay, Func, InfixOperator, Operator,
    PostfixOperator, PrefixOperator, PureNode, RangeDisplay, Value,
};
use crate::errors::ParseError;

use super::Result;
use super::ast::Node;

/// A relative shift (in rows/cols) applied to a formula's **relative**
/// references while unparsing. This is the core primitive shared by
/// autofill and (future) copy/paste: emitting an existing formula AST as
/// if it lived `row`/`col` away from its origin. Absolute components
/// (`$`) and non-positional references (defined names) are untouched.
///
/// Values can be negative (filling up / left). Resolved indices are
/// clamped at 0 so a shift can never produce a negative coordinate.
#[derive(Debug, Clone, Copy)]
pub struct CellShift {
    pub row: i32,
    pub col: i32,
}

impl CellShift {
    pub const ZERO: CellShift = CellShift { row: 0, col: 0 };

    pub fn new(row: i32, col: i32) -> Self {
        CellShift { row, col }
    }
}

/// Unparse a formula AST back to its textual form (no shift).
pub fn unparse<T>(node: &Node, fetcher: &mut T, curr_sheet: SheetId) -> Result<String>
where
    T: NameFetcherTrait,
{
    node.unparse(fetcher, curr_sheet, CellShift::ZERO)
}

/// Unparse a formula AST, shifting every relative reference by `shift`.
/// Used to translate a formula from its source cell to a target cell
/// (autofill / copy-paste relative-reference adjustment).
pub fn unparse_with_shift<T>(
    node: &Node,
    fetcher: &mut T,
    curr_sheet: SheetId,
    shift: CellShift,
) -> Result<String>
where
    T: NameFetcherTrait,
{
    node.unparse(fetcher, curr_sheet, shift)
}

pub trait Stringify {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId, shift: CellShift) -> Result<String>
    where
        T: NameFetcherTrait;
}

impl Stringify for Node {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId, shift: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        if self.bracket {
            Ok(format!(
                "({})",
                self.pure.unparse(fetcher, curr_sheet, shift)?
            ))
        } else {
            self.pure.unparse(fetcher, curr_sheet, shift)
        }
    }
}

impl Stringify for PureNode {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId, shift: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        match self {
            PureNode::Func(func) => func.unparse(fetcher, curr_sheet, shift),
            PureNode::Value(v) => v.unparse(fetcher, curr_sheet, shift),
            PureNode::Reference(cr) => cr.unparse(fetcher, curr_sheet, shift),
            PureNode::BlockRef(node) => node.unparse(fetcher, curr_sheet, shift),
        }
    }
}

impl Stringify for BlockRefNode {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId, shift: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        match self {
            BlockRefNode::Single {
                sheet_id,
                block_id,
                field_id,
                by_block,
                key,
            } => {
                let key_str = key.unparse(fetcher, curr_sheet, shift)?;
                let field_name = fetcher
                    .fetch_block_field_name_by_id(*sheet_id, *block_id, *field_id)
                    .unwrap_or_else(|| String::from("#REF!"));
                if *by_block {
                    Ok(format!(
                        "BLOCKREFB({}, {}, {}, \"{}\")",
                        sheet_id, block_id, key_str, field_name
                    ))
                } else {
                    let ref_name = fetcher
                        .fetch_block_ref_name_by_id(*sheet_id, *block_id)
                        .unwrap_or_else(|| String::from("#REF!"));
                    Ok(format!(
                        "BLOCKREF(\"{}\", {}, \"{}\")",
                        ref_name, key_str, field_name
                    ))
                }
            }
            BlockRefNode::Multi {
                sheet_id,
                block_id,
                by_block,
                key_condition,
                field_condition,
            } => {
                let kc = key_condition.unparse(fetcher, curr_sheet, shift)?;
                let fc = field_condition.unparse(fetcher, curr_sheet, shift)?;
                if *by_block {
                    Ok(format!(
                        "BLOCKREFSB({}, {}, {}, {})",
                        sheet_id, block_id, kc, fc
                    ))
                } else {
                    let ref_name = fetcher
                        .fetch_block_ref_name_by_id(*sheet_id, *block_id)
                        .unwrap_or_else(|| String::from("#REF!"));
                    Ok(format!("BLOCKREFS(\"{}\", {}, {})", ref_name, kc, fc))
                }
            }
        }
    }
}

impl Stringify for Func {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId, shift: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        let args = &self.args;
        match &self.op {
            Operator::Function(fid) => {
                let func_name = fetcher.fetch_func_name(fid)?;
                let args_str =
                    args.iter()
                        .enumerate()
                        .fold(String::from(""), |mut prev, (idx, arg)| {
                            if idx > 0 {
                                prev.push_str(", ");
                            }
                            let arg_str = arg
                                .unparse(fetcher, curr_sheet, shift)
                                .unwrap_or(String::from("error")); // todo
                            prev.push_str(&arg_str);
                            prev
                        });
                Ok(format!("{}({})", func_name, args_str))
            }
            Operator::Infix(op) => {
                let r = format!(
                    "{} {} {}",
                    args.get(0).unwrap().unparse(fetcher, curr_sheet, shift)?,
                    op.unparse(fetcher, curr_sheet, shift)?,
                    args.get(1).unwrap().unparse(fetcher, curr_sheet, shift)?,
                );
                Ok(r)
            }
            Operator::Postfix(op) => Ok(format!(
                "{}{}",
                args.get(0).unwrap().unparse(fetcher, curr_sheet, shift)?,
                op.unparse(fetcher, curr_sheet, shift)?,
            )),
            Operator::Prefix(op) => Ok(format!(
                "{}{}",
                op.unparse(fetcher, curr_sheet, shift)?,
                args.get(0).unwrap().unparse(fetcher, curr_sheet, shift)?,
            )),
            Operator::Comma => {
                let args_str =
                    args.iter()
                        .enumerate()
                        .fold(String::from(""), |mut prev, (idx, arg)| {
                            if idx > 0 {
                                prev.push_str(", ");
                            }
                            let arg_str = arg
                                .unparse(fetcher, curr_sheet, shift)
                                .unwrap_or(String::from("error"));
                            prev.push_str(&arg_str);
                            prev
                        });
                Ok(format!("({})", args_str))
            }
        }
    }
}

impl Stringify for CellReference {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId, shift: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        match self {
            CellReference::Mut(mutref) => mutref.unparse(fetcher, curr_sheet, shift),
            CellReference::UnMut(unmut_ref) => unmut_ref.unparse(fetcher, curr_sheet, shift),
            CellReference::Name(nid) => fetcher.fetch_defined_name(nid).map_err(|e| e.into()),
            CellReference::Ext(ext_ref) => ext_ref.unparse(fetcher, curr_sheet, shift),
            CellReference::RefErr => Ok("#REF!".to_string()),
        }
    }
}

impl Stringify for CubeDisplay {
    fn unparse<T>(&self, fetcher: &mut T, _: SheetId, shift: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        let cube = fetcher.fetch_cube(&self.cube_id)?;
        let from_sheet = fetcher.fetch_sheet_name(&cube.from_sheet)?;
        let to_sheet = fetcher.fetch_sheet_name(&cube.to_sheet)?;
        let prefix = format!("{}:{}", from_sheet, to_sheet);
        let RefAbs {
            start_row,
            start_col,
            end_row,
            end_col,
        } = self.ref_abs;
        let cross_str = match cube.cross {
            CubeCross::Single(row, col) => {
                let row_str = get_row_string(start_row, row, shift.row);
                let col_str = get_col_string(start_col, col, shift.col);
                format!("{}{}", col_str, row_str)
            }
            CubeCross::RowRange(start, end) => {
                let start_str = get_row_string(start_row, start, shift.row);
                let end_str = get_col_string(end_row, end, shift.row);
                format!("{}:{}", start_str, end_str)
            }
            CubeCross::ColRange(start, end) => {
                let start_str = get_row_string(start_col, start, shift.col);
                let end_str = get_col_string(end_col, end, shift.col);
                format!("{}:{}", start_str, end_str)
            }
            CubeCross::AddrRange(start, end) => {
                let sr = get_row_string(start_row, start.row, shift.row);
                let sc = get_col_string(start_col, start.col, shift.col);
                let er = get_row_string(end_row, end.row, shift.row);
                let ec = get_col_string(end_col, end.col, shift.col);
                format!("{}{}:{}{}", sc, sr, ec, er)
            }
        };
        Ok(format!("{}!{}", prefix, cross_str))
    }
}

impl Stringify for ExtRefDisplay {
    fn unparse<T>(&self, fetcher: &mut T, _: SheetId, shift: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        let ext_ref = fetcher.fetch_ext_ref(&self.ext_ref_id)?;
        let workbook_name = fetcher.fetch_book_name(&ext_ref.ext_book)?;
        let sheet = {
            let to_sheet = fetcher.fetch_sheet_name(&ext_ref.to_sheet)?;
            match ext_ref.from_sheet {
                Some(s) => {
                    let from_sheet = fetcher.fetch_sheet_name(&s)?;
                    format!("{}:{}", from_sheet, to_sheet)
                }
                None => to_sheet,
            }
        };
        let RefAbs {
            start_row,
            start_col,
            end_row,
            end_col,
        } = self.ref_abs;
        let cross_str = match ext_ref.cross {
            CubeCross::Single(row, col) => {
                let row_str = get_row_string(start_row, row, shift.row);
                let col_str = get_col_string(start_col, col, shift.col);
                format!("{}{}", col_str, row_str)
            }
            CubeCross::RowRange(start, end) => {
                let start_str = get_row_string(start_row, start, shift.row);
                let end_str = get_col_string(end_row, end, shift.row);
                format!("{}:{}", start_str, end_str)
            }
            CubeCross::ColRange(start, end) => {
                let start_str = get_row_string(start_col, start, shift.col);
                let end_str = get_col_string(end_col, end, shift.col);
                format!("{}:{}", start_str, end_str)
            }
            CubeCross::AddrRange(start, end) => {
                let sr = get_row_string(start_row, start.row, shift.row);
                let sc = get_col_string(start_col, start.col, shift.col);
                let er = get_row_string(end_row, end.row, shift.row);
                let ec = get_col_string(end_col, end.col, shift.col);
                format!("{}{}:{}{}", sc, sr, ec, er)
            }
        };
        Ok(format!("[{}]{}!{}", workbook_name, sheet, cross_str))
    }
}

/// Resolve a positional index for display, applying `shift` when the
/// component is relative (`!abs`). Clamps at 0 so a shift can never
/// underflow into a negative coordinate.
fn shifted_idx(abs: bool, idx: usize, shift: i32) -> usize {
    if abs {
        idx
    } else {
        (idx as i32 + shift).max(0) as usize
    }
}

fn get_row_string(abs: bool, idx: usize, shift: i32) -> String {
    let r = (shifted_idx(abs, idx, shift) + 1).to_string();
    if abs { format!("${}", r) } else { r }
}

fn get_col_string(abs: bool, idx: usize, shift: i32) -> String {
    let c = index_to_column_label(shifted_idx(abs, idx, shift));
    if abs { format!("${}", c) } else { c }
}

impl Stringify for RangeDisplay {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId, shift: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        let prefix = if self.sheet_id == curr_sheet {
            String::new()
        } else {
            let sheet_name = fetcher.fetch_sheet_name(&self.sheet_id)?;
            if sheet_name.len() > 0 {
                format!("{}!", sheet_name)
            } else {
                String::from("")
            }
        };

        let range = fetcher.fetch_range(&self.sheet_id, &self.range_id)?;

        let RefAbs {
            start_row,
            start_col,
            end_row,
            end_col,
        } = self.ref_abs;

        let range_str = match range {
            Range::Normal(normal_range) => {
                let get_normal_cell_str = |sheet: &SheetId,
                                           id: NormalCellId,
                                           row_abs: bool,
                                           col_abs: bool|
                 -> Result<String> {
                    let (row, col) = fetcher.fetch_cell_idx(sheet, &CellId::NormalCell(id))?;
                    let row_str = get_row_string(row_abs, row, shift.row);
                    let col_str = get_col_string(col_abs, col, shift.col);
                    Ok(format!("{}{}", col_str, row_str))
                };
                match normal_range {
                    NormalRange::Single(normal_cell) => {
                        get_normal_cell_str(&curr_sheet, normal_cell, start_row, start_col)
                    }
                    NormalRange::RowRange(start, end) => {
                        let start_idx = fetcher.fetch_row_idx(&curr_sheet, &start)?;
                        let end_idx = fetcher.fetch_row_idx(&curr_sheet, &end)?;
                        let start_str = get_row_string(start_row, start_idx, shift.row);
                        let end_str = get_row_string(end_row, end_idx, shift.row);
                        Ok(format!("{}:{}", start_str, end_str))
                    }
                    NormalRange::ColRange(start, end) => {
                        let start_idx = fetcher.fetch_col_idx(&curr_sheet, &start)?;
                        let end_idx = fetcher.fetch_col_idx(&curr_sheet, &end)?;
                        let start_str = get_col_string(start_row, start_idx, shift.col);
                        let end_str = get_col_string(end_row, end_idx, shift.col);
                        Ok(format!("{}:{}", start_str, end_str))
                    }
                    NormalRange::AddrRange(start, end) => {
                        let start_str =
                            get_normal_cell_str(&curr_sheet, start, start_row, start_col)?;
                        let end_str = get_normal_cell_str(&curr_sheet, end, end_row, end_col)?;
                        Ok(format!("{}:{}", start_str, end_str))
                    }
                }
            }
            Range::Block(block_range) => {
                let get_block_cell_str = |sheet: &SheetId,
                                          id: BlockCellId,
                                          row_abs: bool,
                                          col_abs: bool|
                 -> Result<String> {
                    let (row, col) = fetcher.fetch_cell_idx(sheet, &CellId::BlockCell(id))?;
                    let row_str = get_row_string(row_abs, row, shift.row);
                    let col_str = get_col_string(col_abs, col, shift.col);
                    Ok(format!("{}{}", col_str, row_str))
                };
                match block_range {
                    BlockRange::Single(block_cell_id) => {
                        get_block_cell_str(&curr_sheet, block_cell_id, start_row, start_col)
                    }
                    BlockRange::AddrRange(start, end) => {
                        let start_str =
                            get_block_cell_str(&curr_sheet, start, start_row, start_col)?;
                        let end_str = get_block_cell_str(&curr_sheet, end, end_row, end_col)?;
                        Ok(format!("{}:{}", start_str, end_str))
                    }
                }
            }
            Range::Ephemeral(_) => return Err(ParseError::EphemeralCellInReference.into()),
        }?;
        Ok(format!("{}{}", prefix, range_str))
    }
}

impl Stringify for Value {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId, shift: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        let result = match self {
            Value::Blank => String::from(""),
            Value::Number(f) => format!("{}", f),
            Value::Text(id) => format!("\"{}\"", id),
            Value::Boolean(b) => match b {
                true => "TRUE",
                false => "FALSE",
            }
            .to_string(),
            Value::Error(e) => e.unparse(fetcher, curr_sheet, shift)?,
        };
        Ok(result)
    }
}

impl Stringify for Error {
    fn unparse<T>(&self, _: &mut T, _: SheetId, _: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        Ok(match self {
            // `#FIELD("name")` round-trip: escape the inner string per
            // Excel rules (doubled `"`).
            Error::FieldRef(name) => {
                format!("#FIELD(\"{}\")", name.replace('"', "\"\""))
            }
            other => other.get_err_str().to_string(),
        })
    }
}

impl Stringify for InfixOperator {
    fn unparse<T>(&self, _: &mut T, _: SheetId, _: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        let s = match self {
            InfixOperator::Colon => String::from(":"),
            InfixOperator::Space => String::from(" "),
            InfixOperator::Exp => String::from("^"),
            InfixOperator::Multiply => String::from("*"),
            InfixOperator::Divide => String::from("/"),
            InfixOperator::Plus => String::from("+"),
            InfixOperator::Minus => String::from("-"),
            InfixOperator::Concat => String::from("&"),
            InfixOperator::Eq => String::from("="),
            InfixOperator::Neq => String::from("<>"),
            InfixOperator::Lt => String::from("<"),
            InfixOperator::Le => String::from("<="),
            InfixOperator::Gt => String::from(">"),
            InfixOperator::Ge => String::from(">="),
        };
        Ok(s)
    }
}

impl Stringify for PrefixOperator {
    fn unparse<T>(&self, _: &mut T, _: SheetId, _: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        let s = match self {
            PrefixOperator::Minus => String::from("-"),
            PrefixOperator::Plus => String::from("+"),
        };
        Ok(s)
    }
}

impl Stringify for PostfixOperator {
    fn unparse<T>(&self, _: &mut T, _: SheetId, _: CellShift) -> Result<String>
    where
        T: NameFetcherTrait,
    {
        match self {
            PostfixOperator::Percent => Ok(String::from("%")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::unparse;
    use crate::Parser;
    use crate::context::Context;
    use crate::test_utils::{TestIdFetcher, TestVertexFetcher};

    #[test]
    fn comma_formula_test() {
        let parser = Parser {};
        let sum = "sum((2,3),3)";
        let mut id_fetcher = TestIdFetcher {};
        let mut vertex_fetcher = TestVertexFetcher {};
        let mut context = Context {
            book_name: "book",
            id_fetcher: &mut id_fetcher,
            vertex_fetcher: &mut vertex_fetcher,
        };
        let node = parser.parse(sum, 1, &mut context).unwrap();
        let a = unparse(&node, &mut id_fetcher, 0).unwrap();
        assert_eq!(a, "SUM((2, 3), 3)")
    }

    #[test]
    fn bracket_lhs_pow_roundtrip() {
        let parser = Parser {};
        let mut id_fetcher = TestIdFetcher {};
        let mut vertex_fetcher = TestVertexFetcher {};
        let node = {
            let mut context = Context {
                book_name: "book",
                id_fetcher: &mut id_fetcher,
                vertex_fetcher: &mut vertex_fetcher,
            };
            parser.parse("(1+2)^3", 1, &mut context).unwrap()
        };
        let a = unparse(&node, &mut id_fetcher, 0).unwrap();
        // `(1+2)^3` must NOT round-trip to `1+2^3` — that would silently change
        // the formula's meaning on save/reload.
        assert_eq!(a, "(1 + 2) ^ 3");
    }

    #[test]
    fn brakcet_test() {
        let parser = Parser {};
        let sum = "1*(3-2)";
        let mut id_fetcher = TestIdFetcher {};
        let mut vertex_fetcher = TestVertexFetcher {};
        let mut context = Context {
            book_name: "book",
            id_fetcher: &mut id_fetcher,
            vertex_fetcher: &mut vertex_fetcher,
        };
        let node = parser.parse(sum, 1, &mut context).unwrap();
        let a = unparse(&node, &mut id_fetcher, 0).unwrap();
        assert_eq!(a, "1 * (3 - 2)")
    }
}
