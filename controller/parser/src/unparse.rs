use controller_base::{index_to_column_label, name_fetcher::NameFetcherTrait, SheetId};

use crate::ast::{
    A1Reference, CellReference, Error, ExternalSheet, ExternalSheetToSheet, ExternalUnMutRefPrefix,
    Func, InfixOperator, LocalSheetToSheet, LocalUnMutRefPrefix, MutRef, MutRefWithPrefix,
    Operator, PostfixOperator, PrefixOperator, PureNode, UnMutA1Reference, UnMutA1ReferenceRange,
    UnMutAddress, UnMutColRange, UnMutRef, UnMutRefPrefix, UnMutRefWithPrefix, UnMutRowRange,
    Value,
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
        }
    }
}

impl Stringify for MutRefWithPrefix {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        let sheet = self.sheet_id;
        let prefix = if sheet == curr_sheet {
            "".to_owned()
        } else {
            fetcher.fetch_sheet_name(&sheet)
        };
        let mut get_a1_ref_str = |r: &A1Reference| -> String {
            match r {
                A1Reference::A1ColumnRange(cr) => {
                    let start_id = cr.start;
                    let end_id = cr.end;
                    let start_str = {
                        let idx = fetcher.fetch_col_idx(&sheet, &start_id);
                        let c = index_to_column_label(idx);
                        if cr.start_abs {
                            format!("${}", c)
                        } else {
                            format!("{}", c)
                        }
                    };
                    let end_str = {
                        let idx = fetcher.fetch_col_idx(&sheet, &end_id);
                        let c = index_to_column_label(idx);
                        if cr.end_abs {
                            format!("${}", c)
                        } else {
                            format!("{}", c)
                        }
                    };
                    format!("{}:{}", start_str, end_str)
                }
                A1Reference::A1RowRange(rr) => {
                    let start_id = rr.start;
                    let end_id = rr.end;
                    let start_str = {
                        let idx = fetcher.fetch_row_idx(&sheet, &start_id);
                        if rr.start_abs {
                            format!("${}", idx + 1)
                        } else {
                            format!("{}", idx + 1)
                        }
                    };
                    let end_str = {
                        let idx = fetcher.fetch_row_idx(&sheet, &end_id);
                        if rr.end_abs {
                            format!("${}", idx + 1)
                        } else {
                            format!("{}", idx + 1)
                        }
                    };
                    format!("{}:{}", start_str, end_str)
                }
                A1Reference::Addr(addr) => {
                    let (row, col) = fetcher.fetch_cell_idx(&sheet, &addr.cell_id);
                    let row_str = {
                        let r = (row + 1).to_string();
                        if addr.row_abs {
                            format!("${}", r)
                        } else {
                            r
                        }
                    };
                    let col_str = {
                        let c = index_to_column_label(col);
                        if addr.col_abs {
                            format!("${}", c)
                        } else {
                            c
                        }
                    };
                    format!("{}{}", col_str, row_str)
                }
            }
        };
        let suffix = match &self.reference {
            MutRef::A1ReferenceRange(range) => {
                let start = &range.start;
                let end = &range.end;
                let start_str = get_a1_ref_str(start);
                let end_str = get_a1_ref_str(end);
                format!("{}:{}", start_str, end_str)
            }
            MutRef::A1Reference(r) => get_a1_ref_str(r),
        };
        if prefix != "" {
            format!("{}!{}", prefix, suffix)
        } else {
            suffix
        }
    }
}

impl Stringify for UnMutRefPrefix {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        match self {
            UnMutRefPrefix::Local(local) => match local {
                LocalUnMutRefPrefix::SheetToSheet(sts) => {
                    format!(
                        "{}:{}!",
                        fetcher.fetch_sheet_name(&sts.from_sheet),
                        fetcher.fetch_sheet_name(&sts.to_sheet)
                    )
                }
            },
            UnMutRefPrefix::External(e) => e.unparse(fetcher, curr_sheet),
        }
    }
}

impl Stringify for UnMutRefWithPrefix {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        let prefix = self.prefix.unparse(fetcher, curr_sheet);
        let reference = self.reference.unparse(fetcher, curr_sheet);
        format!("{}{}", prefix, reference)
    }
}

impl Stringify for ExternalUnMutRefPrefix {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        match self {
            ExternalUnMutRefPrefix::Sheet(sheet) => sheet.unparse(fetcher, curr_sheet),
            ExternalUnMutRefPrefix::SheetToSheet(sts) => sts.unparse(fetcher, curr_sheet),
        }
    }
}

impl Stringify for LocalUnMutRefPrefix {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        match self {
            LocalUnMutRefPrefix::SheetToSheet(sts) => sts.unparse(fetcher, curr_sheet),
        }
    }
}

impl Stringify for ExternalSheet {
    fn unparse<T>(&self, fetcher: &mut T, _: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        let workbook = fetcher.fetch_book_name(&self.workbook);
        let sheet = fetcher.fetch_sheet_name(&self.sheet);
        format!("[{}]{}!", workbook, sheet)
    }
}

impl Stringify for ExternalSheetToSheet {
    fn unparse<T>(&self, fetcher: &mut T, _: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        let workbook = fetcher.fetch_book_name(&self.workbook);
        let from_sheet = fetcher.fetch_sheet_name(&self.from_sheet);
        let to_sheet = fetcher.fetch_sheet_name(&self.to_sheet);
        format!("[{}]{}:{}!", workbook, from_sheet, to_sheet)
    }
}

impl Stringify for LocalSheetToSheet {
    fn unparse<T>(&self, fetcher: &mut T, _: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        let from_sheet = fetcher.fetch_sheet_name(&self.from_sheet);
        let to_sheet = fetcher.fetch_sheet_name(&self.to_sheet);
        format!("{}:{}", from_sheet, to_sheet)
    }
}

impl Stringify for UnMutRef {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        match self {
            UnMutRef::A1ReferenceRange(range) => range.unparse(fetcher, curr_sheet),
            UnMutRef::A1Reference(a1) => a1.unparse(fetcher, curr_sheet),
        }
    }
}

impl Stringify for UnMutA1Reference {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        match self {
            UnMutA1Reference::A1ColumnRange(unmut_col_range) => {
                unmut_col_range.unparse(fetcher, curr_sheet)
            }
            UnMutA1Reference::A1RowRange(unmut_row_range) => {
                unmut_row_range.unparse(fetcher, curr_sheet)
            }
            UnMutA1Reference::Addr(addr) => addr.unparse(fetcher, curr_sheet),
        }
    }
}

impl Stringify for UnMutA1ReferenceRange {
    fn unparse<T>(&self, fetcher: &mut T, curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        format!(
            "{}:{}",
            self.start.unparse(fetcher, curr_sheet),
            self.end.unparse(fetcher, curr_sheet)
        )
    }
}

impl Stringify for UnMutColRange {
    fn unparse<T>(&self, _: &mut T, _curr_sheet: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        format!(
            "{}{}:{}{}",
            abs_str(self.start_abs),
            index_to_column_label(self.start),
            abs_str(self.end_abs),
            index_to_column_label(self.end)
        )
    }
}

impl Stringify for UnMutRowRange {
    fn unparse<T>(&self, _: &mut T, _: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        format!(
            "{}{}:{}{}",
            abs_str(self.start_abs),
            self.start + 1,
            abs_str(self.end_abs),
            self.end + 1,
        )
    }
}

impl Stringify for UnMutAddress {
    fn unparse<T>(&self, _: &mut T, _: SheetId) -> String
    where
        T: NameFetcherTrait,
    {
        format!(
            "{}{}{}{}",
            abs_str(self.col_abs),
            index_to_column_label(self.col),
            abs_str(self.row_abs),
            self.row + 1,
        )
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
            Value::Text(id) => format!("\"{}\"", fetcher.fetch_text(id)),
            Value::Boolean(b) => match b {
                true => "TRUE",
                false => "FALSE",
            }
            .to_string(),
            Value::Error(e) => e.unparse(fetcher, curr_sheet),
            Value::Date(_) => todo!(),
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

fn abs_str(abs: bool) -> String {
    if abs {
        String::from("$")
    } else {
        String::from("")
    }
}

#[cfg(test)]
mod tests {
    use super::unparse;
    use crate::context::Context;
    use crate::test_utils::TestFetcher;
    use crate::Parser;

    #[test]
    fn unparse_formula_test() {
        let parser = Parser {};
        let sum = "sum(A1:B3,3, A2)";
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 0,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let node = parser.parse(sum, &mut context).unwrap();
        let a = unparse(&node, &mut id_fetcher, 0);
        assert_eq!(a, "SUM(A1:B3, 3, A2)")
    }

    #[test]
    fn comma_formula_test() {
        let parser = Parser {};
        let sum = "sum((2,3),3)";
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let node = parser.parse(sum, &mut context).unwrap();
        let a = unparse(&node, &mut id_fetcher, 0);
        assert_eq!(a, "SUM((2, 3), 3)")
    }

    #[test]
    fn brakcet_test() {
        let parser = Parser {};
        let sum = "1*(3-2)";
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let node = parser.parse(sum, &mut context).unwrap();
        let a = unparse(&node, &mut id_fetcher, 0);
        assert_eq!(a, "1 * (3 - 2)")
    }
}
