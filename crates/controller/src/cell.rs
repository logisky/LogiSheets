use logisheets_base::CellValue;
use logisheets_base::StyleId;

#[derive(Debug, Clone, Default)]
pub struct Cell {
    pub value: CellValue,
    pub style: StyleId,
}
