use logisheets_base::CellValue;

use super::style::CellStylePayload;

#[derive(Debug, Clone)]
pub struct CellPayload {
    pub row: usize,
    pub col: usize,
    pub change: CellChange,
}

#[derive(Debug, Clone)]
pub enum CellChange {
    Recalc,
    Value(CellValue),
    DiffStyle(Vec<CellStylePayload>),
}
