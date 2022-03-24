use chrono::{DateTime, FixedOffset};
use controller_base::{CellId, ColId, ExtBookId, FuncId, NameId, RowId, SheetId};
use std::hash::{Hash, Hasher};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    Unspecified,
    Div0,
    Na,
    Name,
    Null,
    Num,
    Ref,
    Value,
    GettingData,
}

impl Error {
    pub fn get_err_str(&self) -> &'static str {
        match self {
            Error::Unspecified => "#UNKNOWN!",
            Error::Div0 => "#DIV/0!",
            Error::Na => "#N/A",
            Error::Name => "#NAME?",
            Error::Null => "#NULL!",
            Error::Num => "#NUM!",
            Error::Ref => "#REF!",
            Error::Value => "#VALUE!",
            Error::GettingData => "#GETTING_DATA",
        }
    }

    pub fn from_err_str(t: &str) -> Self {
        match t {
            "#UNKNOWN!" => Error::Unspecified,
            "#DIV/0!" => Error::Div0,
            "#N/A" => Error::Na,
            "#NAME?" => Error::Name,
            "#NULL!" => Error::Null,
            "#NUM!" => Error::Num,
            "#REF!" => Error::Ref,
            "#VALUE!" => Error::Value,
            "#GETTING_DATA" => Error::GettingData,
            _ => Error::Unspecified,
        }
    }
}

#[derive(Debug, Clone)]
pub enum InfixOperator {
    Colon,
    Space,
    Exp,
    Multiply,
    Divide,
    Plus,
    Minus,
    Concat,
    Eq,
    Neq,
    Lt,
    Le,
    Gt,
    Ge,
}

#[derive(Debug, Clone)]
pub enum PrefixOperator {
    Minus,
    Plus,
}

#[derive(Debug, Clone)]
pub enum PostfixOperator {
    Percent,
}

#[derive(Debug, Clone)]
pub enum Value {
    Blank,
    Number(f64),
    Text(String),
    Boolean(bool),
    Error(Error),
    Date(DateTime<FixedOffset>),
}

#[derive(Debug, Clone)]
pub enum Operator {
    Function(FuncId),
    Infix(InfixOperator),
    Postfix(PostfixOperator),
    Prefix(PrefixOperator),
    Comma,
}

#[derive(Debug, Clone)]
pub struct Func {
    pub op: Operator,
    pub args: Vec<Node>,
}

#[derive(Debug, Clone)]
pub enum PureNode {
    Func(Func),
    Value(Value),
    Reference(CellReference),
}

#[derive(Debug, Clone)]
pub struct Node {
    pub pure: PureNode,
    pub bracket: bool,
}

#[derive(Debug, Clone, Eq)]
pub struct Address {
    pub cell_id: CellId,
    pub row_abs: bool,
    pub col_abs: bool,
}

impl Hash for Address {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.cell_id.hash(state);
    }
}

impl PartialEq for Address {
    fn eq(&self, other: &Self) -> bool {
        self.cell_id.eq(&other.cell_id)
    }
}

#[derive(Debug, Clone, Eq)]
pub struct RowRange {
    pub start: RowId,
    pub start_abs: bool,
    pub end: RowId,
    pub end_abs: bool,
}

impl Hash for RowRange {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.start.hash(state);
        self.end.hash(state);
    }
}

impl PartialEq for RowRange {
    fn eq(&self, other: &Self) -> bool {
        self.start == other.start && self.end == other.end
    }
}

#[derive(Debug, Clone, Eq)]
pub struct ColRange {
    pub start: ColId,
    pub start_abs: bool,
    pub end: ColId,
    pub end_abs: bool,
}

impl Hash for ColRange {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.start.hash(state);
        self.end.hash(state);
    }
}

impl PartialEq for ColRange {
    fn eq(&self, other: &Self) -> bool {
        self.start == other.start && self.end == other.end
    }
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum A1Reference {
    A1ColumnRange(ColRange),
    A1RowRange(RowRange),
    Addr(Address),
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct A1ReferenceRange {
    pub start: A1Reference,
    pub end: A1Reference,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum CellReference {
    Mut(MutRefWithPrefix),
    UnMut(UnMutRefWithPrefix),
    Name(NameId),
}

impl CellReference {
    pub fn from_cell_id(sheet_id: SheetId, cell_id: CellId) -> Self {
        let addr = Address {
            cell_id,
            row_abs: false,
            col_abs: false,
        };
        CellReference::Mut(MutRefWithPrefix {
            sheet_id,
            reference: MutRef::A1Reference(A1Reference::Addr(addr)),
        })
    }
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct MutRefWithPrefix {
    pub sheet_id: SheetId,
    pub reference: MutRef,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum MutRef {
    A1ReferenceRange(A1ReferenceRange),
    A1Reference(A1Reference),
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct UnMutRefWithPrefix {
    pub prefix: UnMutRefPrefix,
    pub reference: UnMutRef,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum UnMutRefPrefix {
    Local(LocalUnMutRefPrefix),
    External(ExternalUnMutRefPrefix),
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum LocalUnMutRefPrefix {
    SheetToSheet(LocalSheetToSheet),
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum ExternalUnMutRefPrefix {
    Sheet(ExternalSheet),
    SheetToSheet(ExternalSheetToSheet),
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct LocalSheetToSheet {
    pub from_sheet: SheetId,
    pub to_sheet: SheetId,
}
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct ExternalSheetToSheet {
    pub workbook: ExtBookId,
    pub from_sheet: SheetId,
    pub to_sheet: SheetId,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct ExternalSheet {
    pub workbook: ExtBookId,
    pub sheet: SheetId,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum UnMutRef {
    A1ReferenceRange(UnMutA1ReferenceRange),
    A1Reference(UnMutA1Reference),
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum UnMutA1Reference {
    A1ColumnRange(UnMutColRange),
    A1RowRange(UnMutRowRange),
    Addr(UnMutAddress),
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct UnMutA1ReferenceRange {
    pub start: UnMutA1Reference,
    pub end: UnMutA1Reference,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnMutAddress {
    pub row: usize,
    pub row_abs: bool,
    pub col: usize,
    pub col_abs: bool,
}

impl Hash for UnMutAddress {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.row.hash(state);
        self.col.hash(state);
    }
}

#[derive(Debug, Clone, Eq)]
pub struct UnMutRowRange {
    pub start: usize,
    pub start_abs: bool,
    pub end: usize,
    pub end_abs: bool,
}

impl Hash for UnMutRowRange {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.start.hash(state);
        self.end.hash(state);
    }
}

impl PartialEq for UnMutRowRange {
    fn eq(&self, other: &Self) -> bool {
        self.start == other.start && self.end == other.end
    }
}

#[derive(Debug, Clone, Eq)]
pub struct UnMutColRange {
    pub start: usize,
    pub start_abs: bool,
    pub end: usize,
    pub end_abs: bool,
}

impl Hash for UnMutColRange {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.start.hash(state);
        self.end.hash(state);
    }
}

impl PartialEq for UnMutColRange {
    fn eq(&self, other: &Self) -> bool {
        self.start == other.start && self.end == other.end
    }
}

#[cfg(test)]
mod tests {
    use super::RowRange;
    use std::collections::HashMap;

    #[test]
    fn row_range_hash() {
        let rr1 = RowRange {
            start: 2,
            start_abs: false,
            end: 1,
            end_abs: true,
        };
        let rr2 = RowRange {
            start: 2,
            start_abs: true,
            end: 1,
            end_abs: false,
        };
        let mut data = HashMap::<RowRange, u32>::new();
        data.insert(rr1, 10);
        if let Some(r) = data.get(&rr2) {
            assert_eq!(r.clone(), 10);
        } else {
            panic!()
        }
    }
}
