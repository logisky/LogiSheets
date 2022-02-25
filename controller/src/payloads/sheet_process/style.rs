use xlrs_workbook::complex_types::Color;
use xlrs_workbook::simple_types::{StPatternType, StUnderlineValues, StBorderStyle};

#[derive(Debug, Clone)]
pub enum FontPayloadType {
    Bold(bool),
    Italic(bool),
    Size(f64),
    Shadow(bool),
    Underline(StUnderlineValues::Type),
}

#[derive(Debug, Clone)]
pub enum BorderPayloadType {
    LeftBorderColor(String),
    RightBorderColor(String),
    TopBorderColor(String),
    BottomBorderColor(String),
    LeftBorderStyle(StBorderStyle::Type),
    RightBorderStyle(StBorderStyle::Type),
    TopBorderStyle(StBorderStyle::Type),
    BottomBorderStyle(StBorderStyle::Type),
    BorderDiagonalUp(bool),
    BorderDiagonalDown(bool),
    Outline(bool),
}

#[derive(Debug, Clone)]
pub enum FillPayloadType {
    Pattern(PatternPayload),
    Graident(GradientPayload),
}

#[derive(Debug, Clone)]
pub enum PatternPayload {
    FgColor(Option<Color>),
    BgColor(Option<Color>),
    Type(Option<StPatternType::Type>),
}

#[derive(Debug, Clone)]
pub enum GradientPayload {
    Degree(f64),
    Left(f64),
    Right(f64),
    Top(f64),
    Bottom(f64),
}

#[derive(Debug, Clone)]
pub enum CellStylePayload {
    Font(FontPayloadType),
    Border(BorderPayloadType),
    Fill(FillPayloadType),
}
