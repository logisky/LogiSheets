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
    InsertRow(ShiftData),
    InsertCol(ShiftData),
    DeleteRow(ShiftData),
    DeleteCol(ShiftData),
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
pub struct ShiftData {
    pub from: u32,
    pub cnt: u32,
}
