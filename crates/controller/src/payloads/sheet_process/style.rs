use logisheets_workbook::prelude::*;

#[derive(Debug, Clone)]
pub enum FontPayloadType {
    Bold(bool),
    Italic(bool),
    Size(f64),
    Shadow(bool),
    Underline(StUnderlineValues),
    Name(String),
    Outline(bool),
    Strike(bool),
    Condense(bool),
}

#[derive(Debug, Clone)]
pub enum BorderPayloadType {
    LeftBorderColor(String),
    RightBorderColor(String),
    TopBorderColor(String),
    BottomBorderColor(String),
    LeftBorderStyle(StBorderStyle),
    RightBorderStyle(StBorderStyle),
    TopBorderStyle(StBorderStyle),
    BottomBorderStyle(StBorderStyle),
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
    FgColor(Option<CtColor>),
    BgColor(Option<CtColor>),
    Type(Option<StPatternType>),
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
