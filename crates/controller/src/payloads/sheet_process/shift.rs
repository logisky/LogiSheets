#[derive(Debug, Clone)]
pub enum ShiftPayload {
    Line(LineShift),
    Range(RangeShift),
}

#[derive(Debug, Clone)]
pub struct LineShift {
    pub start: usize,
    pub cnt: u32,
    pub ty: ShiftType,
    pub direction: Direction,
}

#[derive(Debug, Clone)]
pub struct RangeShift {
    pub row: usize,
    pub col: usize,
    pub row_cnt: u32,
    pub col_cnt: u32,
    pub ty: ShiftType,
    pub direction: Direction,
}

#[derive(Debug, Clone)]
pub enum Direction {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone)]
pub enum ShiftType {
    Delete,
    Insert,
}
