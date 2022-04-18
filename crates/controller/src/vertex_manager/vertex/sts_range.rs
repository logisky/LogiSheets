use logisheets_base::SheetId;
use logisheets_parser::ast;

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct StsRangeVertex {
    pub start: SheetId,
    pub end: SheetId,
    pub reference: UnMutRefVertex,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct UnMutRowRange {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct UnMutColRange {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct AddrRange {
    pub row_start: usize,
    pub col_start: usize,
    pub row_end: usize,
    pub col_end: usize,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum UnMutRefVertex {
    ColRange(UnMutColRange),
    RowRange(UnMutRowRange),
    AddrRange(AddrRange),
}

impl UnMutRefVertex {
    pub fn from_unmut_ref(r: ast::UnMutRef) -> Self {
        match r {
            ast::UnMutRef::A1ReferenceRange(range) => match (range.start, range.end) {
                (ast::UnMutA1Reference::Addr(s), ast::UnMutA1Reference::Addr(e)) => {
                    let addr_range = AddrRange {
                        row_start: s.row,
                        row_end: e.row,
                        col_start: s.col,
                        col_end: e.col,
                    };
                    UnMutRefVertex::AddrRange(addr_range)
                }
                _ => unreachable!(),
            },
            ast::UnMutRef::A1Reference(r) => match r {
                ast::UnMutA1Reference::A1ColumnRange(cr) => {
                    let range = UnMutColRange {
                        start: cr.start,
                        end: cr.end,
                    };
                    UnMutRefVertex::ColRange(range)
                }
                ast::UnMutA1Reference::A1RowRange(rr) => {
                    let range = UnMutRowRange {
                        start: rr.start,
                        end: rr.end,
                    };
                    UnMutRefVertex::RowRange(range)
                }
                ast::UnMutA1Reference::Addr(addr) => {
                    let range = AddrRange {
                        row_start: addr.row,
                        row_end: addr.row,
                        col_start: addr.col,
                        col_end: addr.col,
                    };
                    UnMutRefVertex::AddrRange(range)
                }
            },
        }
    }
}
