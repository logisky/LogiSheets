use logisheets_controller::{
    edit_action::{CreateBlock, MoveBlock, RemoveBlock, ResizeBlock},
    BlockId,
};

#[derive(Debug)]
pub struct Statement {
    pub op: Operator,
    pub line: usize,
}

#[derive(Debug)]
pub enum Operator {
    Switch(Switch),
    Input(Input),
    CheckNum(CheckNum),
    CheckString(CheckString),
    CheckError(CheckError),
    CheckFormula(CheckFormula),
    CheckEmpty(CheckEmpty),
    InsertRow(ShiftData),
    InsertCol(ShiftData),
    DeleteRow(ShiftData),
    DeleteCol(ShiftData),
    CreateBlock(CreateBlock), // ignore the sheet_idx
    MoveBlock(MoveBlock),
    RemoveBlock(RemoveBlock),
    ResizeBlock(ResizeBlock),
    BlockInsertRow(BlockShiftData),
    BlockInsertCol(BlockShiftData),
    BlockDeleteRow(BlockShiftData),
    BlockDeleteCol(BlockShiftData),
}

#[derive(Debug)]
pub struct Switch {
    pub sheet: String,
}

#[derive(Debug)]
pub struct Input {
    pub row: u32,
    pub col: u32,
    pub content: String,
}

#[derive(Debug)]
pub struct CheckNum {
    pub row: u32,
    pub col: u32,
    pub expect: f64,
}

#[derive(Debug)]
pub struct CheckString {
    pub row: u32,
    pub col: u32,
    pub expect: String,
}

#[derive(Debug)]
pub struct CheckEmpty {
    pub row: u32,
    pub col: u32,
}

#[derive(Debug)]
pub struct CheckError {
    pub row: u32,
    pub col: u32,
    pub expect: String,
}

#[derive(Debug)]
pub struct CheckFormula {
    pub row: u32,
    pub col: u32,
    pub expect: String,
}

#[derive(Debug)]
pub struct ShiftData {
    pub from: u32,
    pub cnt: u32,
}

#[derive(Debug)]
pub struct BlockShiftData {
    pub block_id: BlockId,
    pub from: u32,
    pub cnt: u32,
}
