use logisheets_workbook::prelude::*;

#[derive(Debug)]
pub struct StyleUpdate {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub ty: Vec<StyleUpdateType>,
}

pub type Color = String;

#[derive(Debug)]
pub enum StyleUpdateType {
    SetFontBold(bool),
    SetFontItalic(bool),
    SetFontUnderline(SetFontUnderline),
    SetFontColor(Color),
    SetFontSize(f64),
    SetFontName(String),
    SetFontOutline(bool),
    SetFontShadow(bool),
    SetFontStrike(bool),
    SetFontCondense(bool),
    SetLeftBorderColor(Color),
    SetRightBorderColor(Color),
    SetTopBorderColor(Color),
    SetBottomBorderColor(Color),
    SetLeftBorderStyle(SetBorderStyle),
    SetRightBorderStyle(SetBorderStyle),
    SetTopBorderStyle(SetBorderStyle),
    SetBottomBorderStyle(SetBorderStyle),
    SetBorderDiagonalUp(bool),
    SetBorderDiagonalDown(bool),
    SetPatternFill(SetPatternFill),
}

#[derive(Debug)]
pub struct SetFontUnderline {
    pub underline: StUnderlineValues,
}

#[derive(Debug)]
pub struct SetBorderPr {
    pub location: BorderLocation,
    pub pr: CtBorderPr,
}

#[derive(Debug)]
pub struct SetBorderStyle {
    pub ty: StBorderStyle,
}

#[derive(Debug)]
pub struct SetBorderDiagonalUp {
    pub diagonal_up: bool,
}

#[derive(Debug)]
pub struct SetBorderDiagonalDown {
    pub diagonal_down: bool,
}

#[derive(Debug)]
pub struct SetBorderOutline {
    pub outline: bool,
}

#[derive(Debug)]
pub enum BorderLocation {
    Left,
    Right,
    Top,
    Bottom,
    Diagonal,
    Vertical,
    Horizontal,
}

#[derive(Debug)]
pub struct SetPatternFill {
    pub pattern_fill: CtPatternFill,
}
