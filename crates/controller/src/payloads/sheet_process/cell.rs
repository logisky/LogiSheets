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
    // Here we should have only one payload in principle. Considering that
    // styles often change frequently, we use a vector here to make an easier debugging.
    DiffStyle(Vec<CellStylePayload>),
}
