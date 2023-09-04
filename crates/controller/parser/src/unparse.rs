use logisheets_base::{
    index_to_column_label, name_fetcher::NameFetcherTrait, BlockCellId, BlockRange, CellId,
    CubeCross, NormalCellId, NormalRange, Range, RefAbs, SheetId,
};

use crate::ast::{
    CellReference, CubeDisplay, Error, ExtRefDisplay, Func, InfixOperator, Operator,
    PostfixOperator, PrefixOperator, PureNode, RangeDisplay, Value,
};

use super::ast::Node;

pub fn unparse<T>(node: &Node, fetcher: &mut T, curr_sheet: SheetId) -> String
where
    T: NameFetcherTrait,
{
    node.unparse(fetcher, curr_sheet)
}

pub trait Stringify {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait;
}

impl Stringify for Node {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        if self.bracket {
            format!("({})", self.pure.unparse(fetcher, curr_sheet))
        } else {
            self.pure.unparse(fetcher, curr_sheet)
        }
    }
}

impl Stringify for PureNode {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        match self {
            PureNode::Func(func) => func.unparse(fetcher, curr_sheet),
            PureNode::Value(v) => v.unparse(fetcher, curr_sheet),
            PureNode::Reference(cr) => cr.unparse(fetcher, curr_sheet),
        }
    }
}

impl Stringify for Func {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        let args = &self.args;
        match &self.op {
            Operator::Function(fid) => {
                let func_name = fetcher.fetch_func_name(fid);
                let args_str =
                    args.iter()
                        .enumerate()
                        .fold(String::from(""), |mut prev, (idx, arg)| {
                            if idx > 0 {
                                prev.push_str(", ");
                            }
                            let arg_str = arg.unparse(fetcher, curr_sheet);
                            prev.push_str(&arg_str);
                            prev
                        });
                format!("{}({})", func_name, args_str)
            }
            Operator::Infix(op) => {
                format!(
                    "{} {} {}",
                    args.get(0).unwrap().unparse(fetcher, curr_sheet),
                    op.unparse(fetcher, curr_sheet),
                    args.get(1).unwrap().unparse(fetcher, curr_sheet),
                )
            }
            Operator::Postfix(op) => {
                format!(
                    "{}{}",
                    args.get(0).unwrap().unparse(fetcher, curr_sheet),
                    op.unparse(fetcher, curr_sheet),
                )
            }
            Operator::Prefix(op) => {
                format!(
                    "{}{}",
                    op.unparse(fetcher, curr_sheet),
                    args.get(0).unwrap().unparse(fetcher, curr_sheet),
                )
            }
            Operator::Comma => {
                let args_str =
                    args.iter()
                        .enumerate()
                        .fold(String::from(""), |mut prev, (idx, arg)| {
                            if idx > 0 {
                                prev.push_str(", ");
                            }
                            let arg_str = arg.unparse(fetcher, curr_sheet);
                            prev.push_str(&arg_str);
                            prev
                        });
                format!("({})", args_str)
            }
        }
    }
}

impl Stringify for CellReference {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        match self {
            CellReference::Mut(mutref) => mutref.unparse(fetcher, curr_sheet),
            CellReference::UnMut(unmut_ref) => unmut_ref.unparse(fetcher, curr_sheet),
            CellReference::Name(nid) => fetcher.fetch_defined_name(nid),
            CellReference::Ext(ext_ref) => ext_ref.unparse(fetcher, curr_sheet),
        }
    }
}

impl Stringify for CubeDisplay {
    fn unparse<T>(&self, fetcher: &mut T, _: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        let cube = fetcher.fetch_cube(&self.cube_id);
        let from_sheet = fetcher.fetch_sheet_name(&cube.from_sheet);
        let to_sheet = fetcher.fetch_sheet_name(&cube.to_sheet);
        let prefix = format!("{}:{}", from_sheet, to_sheet);
        let RefAbs {
            start_row,
            start_col,
            end_row,
            end_col,
        } = self.ref_abs;
        let cross_str = match cube.cross {
            CubeCross::Single(row, col) => {
                let row_str = get_row_string(start_row, row);
                let col_str = get_col_string(start_col, col);
                format!("{}{}", col_str, row_str)
            }
            CubeCross::RowRange(start, end) => {
                let start_str = get_row_string(start_row, start);
                let end_str = get_col_string(end_row, end);
                format!("{}:{}", start_str, end_str)
            }
            CubeCross::ColRange(start, end) => {
                let start_str = get_row_string(start_col, start);
                let end_str = get_col_string(end_col, end);
                format!("{}:{}", start_str, end_str)
            }
            CubeCross::AddrRange(start, end) => {
                let sr = get_row_string(start_row, start.row);
                let sc = get_col_string(start_col, start.col);
                let er = get_row_string(end_row, end.row);
                let ec = get_col_string(end_col, end.col);
                format!("{}{}:{}{}", sc, sr, ec, er)
            }
        };
        format!("{}!{}", prefix, cross_str)
    }
}

impl Stringify for ExtRefDisplay {
    fn unparse<T>(&self, fetcher: &mut T, _: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        let ext_ref = fetcher.fetch_ext_ref(&self.ext_ref_id);
        let workbook_name = fetcher.fetch_book_name(&ext_ref.ext_book);
        let sheet = {
            let to_sheet = fetcher.fetch_sheet_name(&ext_ref.to_sheet);
            match ext_ref.from_sheet {
                Some(s) => {
                    let from_sheet = fetcher.fetch_sheet_name(&s);
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
                let row_str = get_row_string(start_row, row);
                let col_str = get_col_string(start_col, col);
                format!("{}{}", col_str, row_str)
            }
            CubeCross::RowRange(start, end) => {
                let start_str = get_row_string(start_row, start);
                let end_str = get_col_string(end_row, end);
                format!("{}:{}", start_str, end_str)
            }
            CubeCross::ColRange(start, end) => {
                let start_str = get_row_string(start_col, start);
                let end_str = get_col_string(end_col, end);
                format!("{}:{}", start_str, end_str)
            }
            CubeCross::AddrRange(start, end) => {
                let sr = get_row_string(start_row, start.row);
                let sc = get_col_string(start_col, start.col);
                let er = get_row_string(end_row, end.row);
                let ec = get_col_string(end_col, end.col);
                format!("{}{}:{}{}", sc, sr, ec, er)
            }
        };
        format!("[{}]{}!{}", workbook_name, sheet, cross_str)
    }
}

fn get_row_string(abs: bool, idx: usize) -> String {
    let r = (idx + 1).to_string();
    if abs {
        format!("${}", r)
    } else {
        r
    }
}

fn get_col_string(abs: bool, idx: usize) -> String {
    let c = index_to_column_label(idx);
    if abs {
        format!("${}", c)
    } else {
        c
    }
}

impl Stringify for RangeDisplay {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        let prefix = if self.sheet_id == curr_sheet {
            String::new()
        } else {
            let sheet_name = fetcher.fetch_sheet_name(&self.sheet_id);
            if sheet_name.len() > 0 {
                format!("{}!", sheet_name)
            } else {
                String::from("")
            }
        };

        let range = fetcher.fetch_range(&self.sheet_id, &self.range_id);
        if range.is_none() {
            return format!("{}#REF!", prefix);
        }

        let range = range.unwrap();
        let RefAbs {
            start_row,
            start_col,
            end_row,
            end_col,
        } = self.ref_abs;

        let range_str = match range {
            Range::Normal(normal_range) => {
                let get_normal_cell_str =
                    |sheet: &SheetId, id: NormalCellId, row_abs: bool, col_abs: bool| -> String {
                        let (row, col) = fetcher.fetch_cell_idx(sheet, &CellId::NormalCell(id));
                        let row_str = get_row_string(row_abs, row);
                        let col_str = get_col_string(col_abs, col);
                        format!("{}{}", col_str, row_str)
                    };
                match normal_range {
                    NormalRange::Single(normal_cell) => {
                        get_normal_cell_str(&curr_sheet, normal_cell, start_row, start_col)
                    }
                    NormalRange::RowRange(start, end) => {
                        let start_idx = fetcher.fetch_row_idx(&curr_sheet, &start);
                        let end_idx = fetcher.fetch_row_idx(&curr_sheet, &end);
                        let start_str = get_row_string(start_row, start_idx);
                        let end_str = get_row_string(end_row, end_idx);
                        format!("{}:{}", start_str, end_str)
                    }
                    NormalRange::ColRange(start, end) => {
                        let start_idx = fetcher.fetch_col_idx(&curr_sheet, &start);
                        let end_idx = fetcher.fetch_col_idx(&curr_sheet, &end);
                        let start_str = get_col_string(start_row, start_idx);
                        let end_str = get_col_string(end_row, end_idx);
                        format!("{}:{}", start_str, end_str)
                    }
                    NormalRange::AddrRange(start, end) => {
                        let start_str =
                            get_normal_cell_str(&curr_sheet, start, start_row, start_col);
                        let end_str = get_normal_cell_str(&curr_sheet, end, end_row, end_col);
                        format!("{}:{}", start_str, end_str)
                    }
                }
            }
            Range::Block(block_range) => {
                let get_block_cell_str =
                    |sheet: &SheetId, id: BlockCellId, row_abs: bool, col_abs: bool| -> String {
                        let (row, col) = fetcher.fetch_cell_idx(sheet, &CellId::BlockCell(id));
                        let row_str = get_row_string(row_abs, row);
                        let col_str = get_col_string(col_abs, col);
                        format!("{}{}", col_str, row_str)
                    };
                match block_range {
                    BlockRange::Single(block_cell_id) => {
                        get_block_cell_str(&curr_sheet, block_cell_id, start_row, start_col)
                    }
                    BlockRange::AddrRange(start, end) => {
                        let start_str =
                            get_block_cell_str(&curr_sheet, start, start_row, start_col);
                        let end_str = get_block_cell_str(&curr_sheet, end, end_row, end_col);
                        format!("{}:{}", start_str, end_str)
                    }
                }
            }
        };
        format!("{}{}", prefix, range_str)
    }
}

impl Stringify for Value {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        match self {
            Value::Blank => String::from(""),
            Value::Number(f) => format!("{}", f),
            Value::Text(id) => format!("\"{}\"", id),
            Value::Boolean(b) => match b {
                true => "TRUE",
                false => "FALSE",
            }
            .to_string(),
            Value::Error(e) => e.unparse(fetcher, curr_sheet),
        }
    }
}

impl Stringify for Error {
    fn unparse<T>(&self, _: &mut T, _: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        self.get_err_str().to_string()
    }
}

impl Stringify for InfixOperator {
    fn unparse<T>(&self, _: &mut T, _: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        match self {
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
        }
    }
}

impl Stringify for PrefixOperator {
    fn unparse<T>(&self, _: &mut T, _: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        match self {
            PrefixOperator::Minus => String::from("-"),
            PrefixOperator::Plus => String::from("+"),
        }
    }
}

impl Stringify for PostfixOperator {
    fn unparse<T>(&self, _: &mut T, _: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        match self {
            PostfixOperator::Percent => String::from("%"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::unparse;
    use crate::context::Context;
    use crate::test_utils::{TestIdFetcher, TestVertexFetcher};
    use crate::Parser;

    #[test]
    fn comma_formula_test() {
        let parser = Parser {};
        let sum = "sum((2,3),3)";
        let mut id_fetcher = TestIdFetcher {};
        let mut vertex_fetcher = TestVertexFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
            vertex_fetcher: &mut vertex_fetcher,
        };
        let node = parser.parse(sum, &mut context).unwrap();
        let a = unparse(&node, &mut id_fetcher, 0);
        assert_eq!(a, "SUM((2, 3), 3)")
    }

    #[test]
    fn brakcet_test() {
        let parser = Parser {};
        let sum = "1*(3-2)";
        let mut id_fetcher = TestIdFetcher {};
        let mut vertex_fetcher = TestVertexFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
            vertex_fetcher: &mut vertex_fetcher,
        };
        let node = parser.parse(sum, &mut context).unwrap();
        let a = unparse(&node, &mut id_fetcher, 0);
        assert_eq!(a, "1 * (3 - 2)")
    }
}
