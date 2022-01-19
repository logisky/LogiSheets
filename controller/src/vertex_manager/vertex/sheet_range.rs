use controller_base::{CellId, ColId, RowId, SheetId};

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct SheetRangeVertex {
    pub sheet_id: SheetId,
    pub reference: MutReferenceVertex,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum MutReferenceVertex {
    ColRange(MutColRange),
    RowRange(MutRowRange),
    AddrRange(AddrRange),
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct MutColRange {
    pub start: ColId,
    pub end: ColId,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct AddrRange {
    pub start: CellId,
    pub end: CellId,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct MutRowRange {
    pub start: RowId,
    pub end: RowId,
}
