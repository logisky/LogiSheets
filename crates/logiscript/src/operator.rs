use logisheets_controller::controller::edit_action::{
    CreateBlock, LineShiftInBlock, MoveBlock, RemoveBlock,
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
    InsertRow(ShiftData),
    InsertCol(ShiftData),
    DeleteRow(ShiftData),
    DeleteCol(ShiftData),
    CreateBlock(CreateBlock), // ignore the sheet_idx
    MoveBlock(MoveBlock),
    RemoveBlock(RemoveBlock),
    LineShiftInBlock(LineShiftInBlock),
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
