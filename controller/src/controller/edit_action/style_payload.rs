use xlrs_workbook::{
    simple_types::StUnderlineValues,
    styles::{BorderPr, PatternFill},
};

#[derive(Debug)]
pub struct StyleUpdate {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub ty: StyleUpdateType,
}

#[derive(Debug)]
pub enum StyleUpdateType {
    SetFontBold(SetFontBold),
    SetFontItalic(SetFontItalic),
    SetFontUnderline(SetFontUnderline),
    SetFontColor(SetFontColor),
    SetFontSize(SetFontSize),
    SetFontName(SetFontName),
    SetFontOutline(SetFontOutline),
    SetFontShadow(SetFontShadow),
    SetFontStrike(SetFontStrike),
    SetFontCondense(SetFontCondense),
    SetBorderPr(SetBorderPr),
    SetBorderDiagonalUp(SetBorderDiagonalUp),
    SetBorderDiagonalDown(SetBorderDiagonalDown),
    SetPatternFill(SetPatternFill),
}

#[derive(Debug)]
pub struct SetFontBold {
    pub bold: bool,
}

#[derive(Debug)]
pub struct SetFontItalic {
    pub italic: bool,
}

#[derive(Debug)]
pub struct SetFontUnderline {
    pub underline: StUnderlineValues::Type,
}

#[derive(Debug)]
pub struct SetFontColor {
    pub color: String,
}

#[derive(Debug)]
pub struct SetFontSize {
    pub size: f64,
}

#[derive(Debug)]
pub struct SetFontName {
    pub name: String,
}

#[derive(Debug)]
pub struct SetFontOutline {
    pub outline: bool,
}

#[derive(Debug)]
pub struct SetFontShadow {
    pub shadow: bool,
}

#[derive(Debug)]
pub struct SetFontStrike {
    pub strike: bool,
}

#[derive(Debug)]
pub struct SetFontCondense {
    pub condense: bool,
}

#[derive(Debug)]
pub struct SetBorderPr {
    pub location: BorderLocation,
    pub pr: BorderPr,
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
    pub pattern_fill: PatternFill,
}
