use super::style::CellStylePayload;

#[derive(Debug, Clone)]
pub struct LinePayload {
    pub idx: usize,
    pub change: LineInfoUpdate,
}

#[derive(Debug, Clone)]
pub enum LineInfoUpdate {
    Row(RowInfoUpdate),
    Col(ColInfoUpdate),
}

#[derive(Debug, Clone)]
pub enum RowInfoUpdate {
    Collapsed(bool),
    Hidden(bool),
    Height(f64),
    Style(CellStylePayload),
}

#[derive(Debug, Clone)]
pub enum ColInfoUpdate {
    Collapsed(bool),
    Hidden(bool),
    Width(f64),
    Style(CellStylePayload),
}
