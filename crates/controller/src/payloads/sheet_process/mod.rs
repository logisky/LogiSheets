use logisheets_base::SheetId;

pub mod block;
pub mod cell;
pub mod line;
pub mod property;
pub mod shift;
pub mod style;
pub type CellChange = cell::CellChange;
pub type CellPayload = cell::CellPayload;
pub type LinePayload = line::LinePayload;
pub type LineInfoUpdate = line::LineInfoUpdate;
pub type RowInfoUpdate = line::RowInfoUpdate;
pub type ColInfoUpdate = line::ColInfoUpdate;
pub type ShiftPayload = shift::ShiftPayload;
pub type PropertyPayload = property::PropertyPayload;
pub type ShiftType = shift::ShiftType;
pub type LineShift = shift::LineShift;
pub type Direction = shift::Direction;
pub type BlockPayload = block::BlockPayload;
pub type CreateBlock = block::CreateBlockPayload;
pub type MoveBlock = block::MoveBlockPayload;
pub type RemoveBlock = block::RemoveBlockPayload;
pub type BlockInsertColsPayload = block::InsertColsPayload;
pub type BlockInsertRowsPayload = block::InsertRowsPayload;
pub type BlockDeleteColsPayload = block::DeleteColsPayload;
pub type BlockDeleteRowsPayload = block::DeleteRowsPayload;

#[derive(Debug, Clone)]
pub struct SheetProcess {
    pub sheet_id: SheetId,
    pub payload: SheetPayload,
}

#[derive(Debug, Clone)]
pub enum SheetPayload {
    Shift(ShiftPayload),
    Formula(FormulaPayload),
    Cell(CellPayload),
    Line(LinePayload),
    Property(PropertyPayload),
    Block(BlockPayload),
}

#[derive(Debug, Clone)]
pub struct FormulaPayload {
    pub row: usize,
    pub col: usize,
    pub formula: String,
}
